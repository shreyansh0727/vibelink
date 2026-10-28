// Shared helpers for the one-shot release scripts. Publishing uses the
// already-signed-in Google Cloud CLI, so no service-account JSON is needed;
// tokens are read into memory and never printed.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const JSON_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

export async function readProjectConfig(repoRoot) {
  const rcPath = path.join(repoRoot, '.firebaserc');
  const rc = JSON.parse(await readFile(rcPath, 'utf8'));
  const projectId = rc.projects?.default;
  if (!projectId) {
    throw new Error(`${rcPath} has no default project.`);
  }
  const bucket =
    rc.targets?.[projectId]?.storage?.updates?.[0] ??
    `${projectId}.firebasestorage.app`;
  return {
    projectId,
    bucket,
    databaseUrl: `https://${projectId}-default-rtdb.firebaseio.com`,
  };
}

export async function readAppVersion(repoRoot) {
  const gradlePath = path.join(repoRoot, 'android', 'app', 'build.gradle');
  const text = await readFile(gradlePath, 'utf8');
  const code = /versionCode\s+(\d+)/.exec(text);
  const name = /versionName\s+"([^"]+)"/.exec(text);
  if (!code || !name) {
    throw new Error(`Could not read versionCode/versionName from ${gradlePath}.`);
  }
  return { code: Number(code[1]), name: name[1] };
}

export function accessToken() {
  const injected = process.env.GOOGLE_OAUTH_ACCESS_TOKEN?.trim();
  if (injected) {
    return injected;
  }
  try {
    return execFileSync('gcloud', ['auth', 'print-access-token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    }).trim();
  } catch {
    throw new Error(
      'Could not get a Google access token. Run "gcloud auth login" and try ' +
        'again, or set GOOGLE_OAUTH_ACCESS_TOKEN.',
    );
  }
}

async function request(
  url,
  init,
  label,
  { timeoutMs = JSON_TIMEOUT_MS, attempts = 3 } = {},
) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) {
        return response;
      }
      const body = await response.text().catch(() => '');
      const failure = new Error(
        `${label} failed (HTTP ${response.status})${body ? `: ${body.slice(0, 300)}` : ''}`,
      );
      failure.fatal = response.status < 500 && response.status !== 429;
      throw failure;
    } catch (error) {
      if (attempt >= attempts || error?.fatal) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

export function publicUrl(bucket, objectName, downloadToken) {
  const encoded = encodeURIComponent(objectName);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media&token=${downloadToken}`;
}

export async function uploadObject({
  bucket,
  objectName,
  filePath,
  contentType,
  token,
}) {
  const data = await readFile(filePath);
  const downloadToken = randomUUID();
  const encoded = encodeURIComponent(objectName);
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
    bucket,
  )}/o?uploadType=resumable&name=${encoded}`;

  const started = await request(
    uploadUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(data.length),
      },
      body: JSON.stringify({
        name: objectName,
        contentType,
        cacheControl: 'public, max-age=3600',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      }),
    },
    `Upload start for ${objectName}`,
  );
  const sessionUrl = started.headers.get('location');
  if (!sessionUrl) {
    throw new Error(`Upload start for ${objectName} returned no session URL.`);
  }

  await request(
    sessionUrl,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        'Content-Length': String(data.length),
      },
      body: data,
    },
    `Upload of ${objectName}`,
    { timeoutMs: UPLOAD_TIMEOUT_MS, attempts: 1 },
  );

  return {
    sizeBytes: data.length,
    url: publicUrl(bucket, objectName, downloadToken),
  };
}

export async function readDatabase({ databaseUrl, pathName, token }) {
  const response = await request(
    `${databaseUrl}/${pathName}.json`,
    { headers: { Authorization: `Bearer ${token}` } },
    `Read of ${pathName}`,
  );
  return response.json();
}

export async function writeDatabase({ databaseUrl, pathName, value, token }) {
  await request(
    `${databaseUrl}/${pathName}.json`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
    },
    `Write of ${pathName}`,
  );
}

export async function verifyDownload(url) {
  const response = await fetch(url, {
    headers: { Range: 'bytes=0-63' },
    signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
  });
  const status = response.status;
  await response.body?.cancel().catch(() => {});
  if (status !== 206 && status !== 200) {
    throw new Error(
      `The published file is not readable without credentials (HTTP ${status}). ` +
        'Check that storage.rules is deployed for this bucket.',
    );
  }
}

export async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    createReadStream(filePath)
      .on('data', chunk => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}

export function redactUrl(url) {
  return String(url).replace(/([?&]token=)[^&]*/, '$1***');
}

export function formatMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
