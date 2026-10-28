#!/usr/bin/env node
// Publishes a Hermes JS bundle for VibeLink's in-app OTA updater: builds the
// release bundle, uploads it to Cloud Storage and writes appBundles/latest in
// the Realtime Database. The app only ever reads that node and checks the
// download against the published SHA-256 before activating it.
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage:
  node publish-bundle.mjs --version-name <name> --min-version-code <n> \\
    --max-version-code <n> --project <firebase-project-id> \\
    --database-url <https://...> [options]

Required:
  --version-name      JS bundle version shown in the app, e.g. 1.1.1
  --min-version-code  Lowest installed APK versionCode this bundle runs on
  --max-version-code  Highest installed APK versionCode this bundle runs on
  --project           Firebase project ID (or FIREBASE_PROJECT_ID)
  --database-url      Realtime Database URL (or FIREBASE_DATABASE_URL)

Optional:
  --notes             Short release note shown in Settings
  --bundle            Prebuilt Hermes bytecode file; skips the Metro/hermesc build
  --id                Bundle id (default v<version-name>-<sha prefix>)
  --bucket            Storage bucket (default <project>.appspot.com)
  --credentials       Service account JSON; defaults to GOOGLE_APPLICATION_CREDENTIALS / ADC
`;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function requireValue(args, key, envName) {
  const value = args[key] ?? (envName ? process.env[envName] : undefined);
  if (!value) {
    throw new Error(`--${key} is required${envName ? ` (or ${envName})` : ''}.`);
  }
  return value;
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    createReadStream(filePath)
      .on('data', chunk => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}

function hermescPath() {
  const platform =
    process.platform === 'win32'
      ? 'win64-bin'
      : process.platform === 'darwin'
        ? 'osx-bin'
        : 'linux64-bin';
  const binary = process.platform === 'win32' ? 'hermesc.exe' : 'hermesc';
  return path.join(REPO_ROOT, 'node_modules', 'hermes-compiler', 'hermesc', platform, binary);
}

async function assertNoAssets(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    // Metro does not create the assets directory when the bundle has none.
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
  const reactNativeCli = path.join(REPO_ROOT, 'node_modules', 'react-native', 'cli.js');
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
  execFileSync(hermesc, ['-O', '-emit-binary', '-w', '-out', bytecode, jsBundle], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  return bytecode;
}

function sanitizeId(versionName, sha256) {
  const safeVersion = versionName.replace(/[^A-Za-z0-9._-]/g, '-');
  const id = `v${safeVersion}-${sha256.slice(0, 8)}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)) {
    throw new Error('The bundle id is not valid. Pass a shorter --version-name or an explicit --id.');
  }
  return id;
}

async function main() {
  if (process.argv.slice(2).includes('--help')) {
    console.log(USAGE);
    return;
  }
  const args = parseArgs(process.argv.slice(2));

  const versionName = requireValue(args, 'version-name').trim();
  const minVersionCode = positiveInteger(
    requireValue(args, 'min-version-code'),
    '--min-version-code',
  );
  const maxVersionCode = positiveInteger(
    requireValue(args, 'max-version-code'),
    '--max-version-code',
  );
  if (maxVersionCode < minVersionCode) {
    throw new Error('--max-version-code must be greater than or equal to --min-version-code.');
  }
  const projectId = requireValue(args, 'project', 'FIREBASE_PROJECT_ID');
  const databaseUrl = requireValue(args, 'database-url', 'FIREBASE_DATABASE_URL');
  const bucketName =
    args.bucket ?? process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`;
  const notes = (args.notes ?? '').trim();
  const credentialsPath =
    args.credentials ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const workDir = args.bundle ? null : await mkdtemp(path.join(os.tmpdir(), 'vibelink-bundle-'));
  let bundlePath;
  try {
    bundlePath = path.resolve(args.bundle ?? (await buildBundle(workDir)));
    const info = await stat(bundlePath);
    if (!info.isFile()) {
      throw new Error(`${bundlePath} is not a file.`);
    }

    const sha256 = await hashFile(bundlePath);
    const id = args.id ?? sanitizeId(versionName, sha256);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)) {
      throw new Error('--id must be 1-64 letters, digits, dots, dashes or underscores.');
    }

    const credential = credentialsPath
      ? cert(JSON.parse(await readFile(credentialsPath, 'utf8')))
      : applicationDefault();
    const app = initializeApp({ credential, projectId, storageBucket: bucketName });

    const destination = `app-bundles/${id}/index.android.bundle`;
    const token = randomUUID();
    const bucket = getStorage(app).bucket(bucketName);
    await bucket.file(destination).save(await readFile(bundlePath), {
      resumable: false,
      validation: 'crc32c',
      contentType: 'application/octet-stream',
      metadata: {
        cacheControl: 'public, max-age=3600',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
      destination,
    )}?alt=media&token=${token}`;

    const reactNative = JSON.parse(
      await readFile(path.join(REPO_ROOT, 'node_modules', 'react-native', 'package.json'), 'utf8'),
    ).version;

    await getDatabase(app, databaseUrl).ref('appBundles/latest').set({
      id,
      versionName,
      url,
      sha256,
      sizeBytes: info.size,
      minVersionCode,
      maxVersionCode,
      notes,
      publishedAt: Date.now(),
      reactNative,
    });

    const kilobytes = Math.round(info.size / 1024);
    console.log(`Published JS bundle ${versionName} (${id}).`);
    console.log(`  File    ${destination} (${kilobytes} KB, Hermes bytecode)`);
    console.log(`  SHA-256 ${sha256}`);
    console.log(`  Applies ${minVersionCode}–${maxVersionCode} (React Native ${reactNative})`);
    console.log(`  URL     ${url}`);
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
