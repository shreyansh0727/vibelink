#!/usr/bin/env node
// Ships a complete APK update in one run: raises the version when the
// published build is not older, builds the release APK, uploads it and points
// appUpdates/latest at it so installed phones offer the update.
import { execFileSync } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
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
const GRADLE_FILE = path.join(REPO_ROOT, 'android', 'app', 'build.gradle');
const APK_FILE = path.join(
  REPO_ROOT,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);
const APK_METADATA_FILE = path.join(
  REPO_ROOT,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'output-metadata.json',
);
const UPDATES_PATH = 'appUpdates/latest';

const USAGE = `Usage:
  node scripts/update-app.mjs [options]

Builds the release APK, uploads it and writes appUpdates/latest, so every
installed build older than the new versionCode offers the update. The
versionCode/versionName are raised automatically when the published build is
the same or newer; only the APK is produced, never an AAB.

Options:
  --notes <text>  Release note shown in the update prompt
  --bump          Raise the version even when it is already newer than the published one
  --skip-build    Upload the existing release APK instead of running Gradle
  --dry-run       Show what would be published; builds nothing and writes nothing
  --help          Show this message

Needs the gcloud CLI signed in (gcloud auth login), or GOOGLE_OAUTH_ACCESS_TOKEN.
`;

function parseArgs(argv) {
  const flags = new Set(['help', 'bump', 'skip-build', 'dry-run']);
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

function raiseName(versionName) {
  const parts = versionName.split('.');
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) {
    parts[parts.length - 1] = String(Number(last) + 1);
    return parts.join('.');
  }
  return versionName;
}

function nextVersion(current, publishedCode) {
  return {
    code: Math.max(current.code, publishedCode) + 1,
    name: raiseName(current.name),
  };
}

async function raiseGradleVersion(next) {
  const text = await readFile(GRADLE_FILE, 'utf8');
  const updated = text
    .replace(/(versionCode\s+)\d+/, `$1${next.code}`)
    .replace(/(versionName\s+)"[^"]*"/, `$1"${next.name}"`);
  await writeFile(GRADLE_FILE, updated, 'utf8');
}

function buildRelease(version) {
  console.log(`Building VibeLink ${version.name} (versionCode ${version.code})…`);
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  try {
    execFileSync(gradlew, ['assembleRelease', '--console=plain'], {
      cwd: path.join(REPO_ROOT, 'android'),
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });
  } catch {
    throw new Error('The Gradle release build failed; fix the build and run the script again.');
  }
}

async function readBuiltApk(version, skipBuild) {
  let info;
  try {
    info = await stat(APK_FILE);
  } catch {
    throw new Error(
      `${APK_FILE} is missing. Run the script without --skip-build to produce it.`,
    );
  }
  if (!info.isFile()) {
    throw new Error(`${APK_FILE} is not a file.`);
  }
  let built;
  try {
    const metadata = JSON.parse(await readFile(APK_METADATA_FILE, 'utf8'));
    built = metadata.elements?.[0];
  } catch {
    if (!skipBuild) {
      throw new Error(`Could not read ${APK_METADATA_FILE}; rebuild without --skip-build.`);
    }
  }
  if (built && built.versionCode !== version.code) {
    throw new Error(
      `The release APK is versionCode ${built.versionCode} but the build is set to ` +
        `${version.code}. Rebuild without --skip-build, or align build.gradle first.`,
    );
  }
  return info;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(USAGE);
    return;
  }
  const args = parseArgs(argv);
  const config = await readProjectConfig(REPO_ROOT);
  const current = await readAppVersion(REPO_ROOT);
  const token = accessToken();
  const published = await readDatabase({
    databaseUrl: config.databaseUrl,
    pathName: UPDATES_PATH,
    token,
  });
  const publishedCode =
    typeof published?.versionCode === 'number' ? published.versionCode : 0;
  const mustRaise = Boolean(args.bump) || publishedCode >= current.code;
  const version = mustRaise ? nextVersion(current, publishedCode) : current;

  if (args['dry-run']) {
    console.log(
      `Dry run: would publish VibeLink ${version.name} (versionCode ${version.code}) ` +
        `as app-updates/vibelink-${version.code}.apk.`,
    );
    if (mustRaise) {
      console.log(
        `Would raise android/app/build.gradle from ${current.name} (${current.code}) first.`,
      );
    }
    console.log('Nothing was built, uploaded or written.');
    return;
  }

  if (mustRaise) {
    if (args['skip-build']) {
      throw new Error(
        'The version must be raised, but --skip-build would publish a mismatched APK. ' +
          'Run without --skip-build.',
      );
    }
    await raiseGradleVersion(version);
    console.log(`Raised the app to ${version.name} (versionCode ${version.code}).`);
  }

  if (!args['skip-build']) {
    buildRelease(version);
  }
  const info = await readBuiltApk(version, Boolean(args['skip-build']));
  const sha256 = await sha256File(APK_FILE);
  const objectName = `app-updates/vibelink-${version.code}.apk`;
  const notes = (args.notes ?? `VibeLink ${version.name}`).trim();

  console.log(`Uploading ${objectName} (${formatMegabytes(info.size)})…`);
  const uploaded = await uploadObject({
    bucket: config.bucket,
    objectName,
    filePath: APK_FILE,
    contentType: 'application/vnd.android.package-archive',
    token,
  });

  const record = {
    versionCode: version.code,
    versionName: version.name,
    apkUrl: uploaded.url,
    sha256,
    sizeBytes: info.size,
    notes,
    publishedAt: Date.now(),
  };
  await writeDatabase({
    databaseUrl: config.databaseUrl,
    pathName: UPDATES_PATH,
    value: record,
    token,
  });
  await verifyDownload(uploaded.url);
  const checked = await readDatabase({
    databaseUrl: config.databaseUrl,
    pathName: UPDATES_PATH,
    token,
  });
  if (checked?.versionCode !== record.versionCode || checked?.sha256 !== sha256) {
    throw new Error('The published metadata did not read back as written.');
  }

  console.log(`Published VibeLink ${version.name} (versionCode ${version.code}).`);
  console.log(`  APK     ${objectName} (${formatMegabytes(info.size)})`);
  console.log(`  SHA-256 ${sha256}`);
  console.log(`  URL     ${redactUrl(uploaded.url)}`);
  console.log('  Checked download and database read-back.');
  console.log(
    'Phones on older builds show the banner within a day; Settings → APP → ' +
      'Check for updates checks immediately.',
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  console.error('');
  console.error(USAGE);
  process.exitCode = 1;
});
