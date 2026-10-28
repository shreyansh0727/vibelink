#!/usr/bin/env node
// Publishes a release APK for the in-app updater: uploads the file to Cloud
// Storage, then writes appUpdates/latest in the Realtime Database. Clients only
// ever read that node; publishing needs Admin credentials.
import { createHash, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';

const USAGE = `Usage:
  node publish-update.mjs --apk <file.apk> --version-code <n> --version-name <name> \\
    --project <firebase-project-id> --database-url <https://...> [options]

Required:
  --apk              Release APK to publish
  --version-code     Android versionCode of that APK (must be higher than the installed build)
  --version-name     Android versionName, e.g. 1.0.1
  --project          Firebase project ID (or FIREBASE_PROJECT_ID)
  --database-url     Realtime Database URL (or FIREBASE_DATABASE_URL)

Optional:
  --notes            Short release note shown in the update prompt
  --bucket           Storage bucket (default <project>.appspot.com)
  --credentials      Service account JSON; defaults to GOOGLE_APPLICATION_CREDENTIALS / ADC
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

async function main() {
  if (process.argv.slice(2).includes('--help')) {
    console.log(USAGE);
    return;
  }
  const args = parseArgs(process.argv.slice(2));

  const apkPath = path.resolve(requireValue(args, 'apk'));
  const versionCode = Number.parseInt(requireValue(args, 'version-code'), 10);
  const versionName = requireValue(args, 'version-name').trim();
  const projectId = requireValue(args, 'project', 'FIREBASE_PROJECT_ID');
  const databaseUrl = requireValue(args, 'database-url', 'FIREBASE_DATABASE_URL');
  const bucketName =
    args.bucket ?? process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`;
  const notes = (args.notes ?? '').trim();
  const credentialsPath =
    args.credentials ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!Number.isInteger(versionCode) || versionCode <= 0) {
    throw new Error('--version-code must be a positive integer.');
  }
  if (!versionName) {
    throw new Error('--version-name must not be empty.');
  }

  const info = await stat(apkPath);
  if (!info.isFile()) {
    throw new Error(`${apkPath} is not a file.`);
  }
  const apk = await readFile(apkPath);
  const sha256 = createHash('sha256').update(apk).digest('hex');

  const credential = credentialsPath
    ? cert(JSON.parse(await readFile(credentialsPath, 'utf8')))
    : applicationDefault();
  const app = initializeApp({ credential, projectId, storageBucket: bucketName });

  const destination = `app-updates/vibelink-${versionCode}.apk`;
  const token = randomUUID();
  const bucket = getStorage(app).bucket(bucketName);
  await bucket.file(destination).save(apk, {
    resumable: false,
    validation: 'crc32c',
    contentType: 'application/vnd.android.package-archive',
    metadata: {
      cacheControl: 'public, max-age=3600',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const apkUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    destination,
  )}?alt=media&token=${token}`;

  await getDatabase(app, databaseUrl).ref('appUpdates/latest').set({
    versionCode,
    versionName,
    apkUrl,
    sha256,
    sizeBytes: info.size,
    notes,
    publishedAt: Date.now(),
  });

  const megabytes = (info.size / (1024 * 1024)).toFixed(1);
  console.log(`Published VibeLink ${versionName} (code ${versionCode}).`);
  console.log(`  APK     ${destination} (${megabytes} MB)`);
  console.log(`  SHA-256 ${sha256}`);
  console.log(`  URL     ${apkUrl}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  console.error('');
  console.error(USAGE);
  process.exitCode = 1;
});
