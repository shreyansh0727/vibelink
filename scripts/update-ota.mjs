#!/usr/bin/env node
// Ships a JS-only OTA update in one run: builds the release bundle with Metro,
// compiles it to Hermes bytecode, uploads it and points appBundles/latest at
// it. Installed builds in the version range offer the bundle in Settings.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  accessToken,
  formatMegabytes,
  readAppVersion,
  readDatabase,
  readProjectConfig,
  redactUrl,
  sha256File,
  uploadObject,
  verifyDownload,
  writeDatabase,
} from './lib/publish.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLES_PATH = 'appBundles/latest';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const USAGE = `Usage:
  node scripts/update-ota.mjs [options]

Builds the Hermes JS bundle for the current tree, uploads it and writes
appBundles/latest. Installed APKs inside the versionCode range then offer the
bundle in Settings → APP with no new APK. Native changes still need update-app.mjs.

Options:
  --version-name <name>     Bundle label shown in the app (default <app-version>-ota-<MMddHHmm>)
  --min-version-code <n>    Lowest installed APK versionCode (default: current build)
  --max-version-code <n>    Highest installed APK versionCode (default: 2147483647)
  --notes <text>            Release note shown in Settings
  --bundle <file>           Prebuilt Hermes bytecode; skips the Metro/hermesc build
  --id <id>                 Bundle id (default v<version-name>-<sha prefix>)
  --dry-run                 Show what would be published; builds nothing and writes nothing
  --help                    Show this message

Needs the gcloud CLI signed in (gcloud auth login), or GOOGLE_OAUTH_ACCESS_TOKEN.
`;

function parseArgs(argv) {
  const flags = new Set(['help', 'dry-run']);
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    if (flags.has(key)) {
      args[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 2147483647) {
    throw new Error(`${name} must be an integer between 1 and 2147483647.`);
  }
  return parsed;
}

function hermescPath() {
  const platform =
    process.platform === 'win32'
      ? 'win64-bin'
      : process.platform === 'darwin'
        ? 'osx-bin'
        : 'linux64-bin';
  const binary = process.platform === 'win32' ? 'hermesc.exe' : 'hermesc';
  return path.join(
    REPO_ROOT,
    'node_modules',
    'hermes-compiler',
    'hermesc',
    platform,
    binary,
  );
}

async function assertNoAssets(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
  if (entries.length > 0) {
    throw new Error(
      'This bundle produced image assets. VibeLink ships none today, so OTA ' +
        'assets are not supported; remove the asset or extend the loader first.',
    );
  }
}

async function buildBundle(workDir) {
  const reactNativeCli = path.join(
    REPO_ROOT,
    'node_modules',
    'react-native',
    'cli.js',
  );
  const jsBundle = path.join(workDir, 'index.android.bundle.js');
  const assetsDir = path.join(workDir, 'assets');

  console.log('Building the release JS bundle with Metro…');
  execFileSync(
    process.execPath,
    [
      reactNativeCli,
      'bundle',
      '--platform',
      'android',
      '--dev',
      'false',
      '--minify',
      'true',
      '--entry-file',
      'index.js',
      '--bundle-output',
      jsBundle,
      '--assets-dest',
      assetsDir,
    ],
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
  await assertNoAssets(assetsDir);

  const hermesc = hermescPath();
  await stat(hermesc);
  const bytecode = path.join(workDir, 'index.android.bundle');
  console.log('Compiling Hermes bytecode…');
  execFileSync(
    hermesc,
    ['-O', '-emit-binary', '-w', '-out', bytecode, jsBundle],
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
  return bytecode;
}

function timestampSuffix() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}`;
}

function defaultId(versionName, sha256) {
  const safeVersion = versionName.replace(/[^A-Za-z0-9._-]/g, '-');
  return `v${safeVersion}-${sha256.slice(0, 8)}`;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(USAGE);
    return;
  }
  const args = parseArgs(argv);
  const appVersion = await readAppVersion(REPO_ROOT);
  const minVersionCode = args['min-version-code']
    ? positiveInteger(args['min-version-code'], '--min-version-code')
    : appVersion.code;
  const maxVersionCode = args['max-version-code']
    ? positiveInteger(args['max-version-code'], '--max-version-code')
    : 2147483647;
  if (maxVersionCode < minVersionCode) {
    throw new Error(
      '--max-version-code must be greater than or equal to --min-version-code.',
    );
  }
  const versionName = (
    args['version-name'] ?? `${appVersion.name}-ota-${timestampSuffix()}`
  ).trim();
  const notes = (args.notes ?? '').trim();

  if (args['dry-run']) {
    console.log(
      `Dry run: would publish JS bundle "${versionName}" for versionCode ` +
        `${minVersionCode}–${maxVersionCode} from ${
          args.bundle ? path.resolve(args.bundle) : 'a fresh Metro build'
        }.`,
    );
    console.log('Nothing was built, uploaded or written.');
    return;
  }

  const config = await readProjectConfig(REPO_ROOT);
  const token = accessToken();
  const workDir = args.bundle
    ? null
    : await mkdtemp(path.join(os.tmpdir(), 'vibelink-bundle-'));
  try {
    const builtPath = path.resolve(
      args.bundle ?? (await buildBundle(workDir)),
    );
    const info = await stat(builtPath);
    if (!info.isFile()) {
      throw new Error(`${builtPath} is not a file.`);
    }
    const sha256 = await sha256File(builtPath);
    const id = (args.id ?? defaultId(versionName, sha256)).trim();
    if (!SAFE_ID.test(id)) {
      throw new Error(
        '--id must be 1-64 letters, digits, dots, dashes or underscores; ' +
          'pass --id with a shorter value.',
      );
    }

    const published = await readDatabase({
      databaseUrl: config.databaseUrl,
      pathName: BUNDLES_PATH,
      token,
    });
    if (
      published?.sha256 === sha256 &&
      published.versionName === versionName &&
      published.minVersionCode === minVersionCode &&
      published.maxVersionCode === maxVersionCode
    ) {
      console.log(
        `appBundles/latest already serves this exact bundle (${published.id}).`,
      );
      console.log('Nothing was uploaded or written.');
      return;
    }

    const objectName = `app-bundles/${id}/index.android.bundle`;
    console.log(`Uploading ${objectName} (${formatMegabytes(info.size)})…`);
    const uploaded = await uploadObject({
      bucket: config.bucket,
      objectName,
      filePath: builtPath,
      contentType: 'application/octet-stream',
      token,
    });

    const reactNative = JSON.parse(
      await readFile(
        path.join(REPO_ROOT, 'node_modules', 'react-native', 'package.json'),
        'utf8',
      ),
    ).version;
    const record = {
      id,
      versionName,
      url: uploaded.url,
      sha256,
      sizeBytes: info.size,
      minVersionCode,
      maxVersionCode,
      notes,
      publishedAt: Date.now(),
      reactNative,
    };
    await writeDatabase({
      databaseUrl: config.databaseUrl,
      pathName: BUNDLES_PATH,
      value: record,
      token,
    });
    await verifyDownload(uploaded.url);
    const checked = await readDatabase({
      databaseUrl: config.databaseUrl,
      pathName: BUNDLES_PATH,
      token,
    });
    if (checked?.id !== id || checked?.sha256 !== sha256) {
      throw new Error('The published metadata did not read back as written.');
    }

    console.log(`Published JS bundle ${versionName} (${id}).`);
    console.log(`  File    ${objectName} (${formatMegabytes(info.size)}, Hermes bytecode)`);
    console.log(`  SHA-256 ${sha256}`);
    console.log(`  Applies to versionCode ${minVersionCode}–${maxVersionCode}`);
    console.log(`  URL     ${redactUrl(uploaded.url)}`);
    console.log('  Checked download and database read-back.');
    console.log(
      'Phones in that range see it in Settings → APP; older APKs without the ' +
        'OTA loader need update-app.mjs first.',
    );
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  console.error('');
  console.error(USAGE);
  process.exitCode = 1;
});
