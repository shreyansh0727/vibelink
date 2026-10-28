export type UpdateInfo = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  sizeBytes: number;
  notes: string;
  publishedAt: number | null;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseUpdateInfo(value: unknown): UpdateInfo | null {
  if (!isRecord(value)) {
    return null;
  }
  const { versionCode, versionName, apkUrl, sha256, sizeBytes, notes } = value;
  if (
    typeof versionCode !== 'number' ||
    !Number.isInteger(versionCode) ||
    versionCode <= 0
  ) {
    return null;
  }
  if (typeof versionName !== 'string' || versionName.trim() === '') {
    return null;
  }
  if (typeof apkUrl !== 'string' || !/^https:\/\//i.test(apkUrl)) {
    return null;
  }
  if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) {
    return null;
  }
  if (
    typeof sizeBytes !== 'number' ||
    !Number.isFinite(sizeBytes) ||
    sizeBytes <= 0
  ) {
    return null;
  }
  return {
    versionCode,
    versionName: versionName.trim(),
    apkUrl,
    sha256: sha256.toLowerCase(),
    sizeBytes,
    notes: typeof notes === 'string' ? notes.trim() : '',
    publishedAt:
      typeof value.publishedAt === 'number' &&
      Number.isFinite(value.publishedAt)
        ? value.publishedAt
        : null,
  };
}

export function isNewerVersion(info: UpdateInfo, versionCode: number): boolean {
  return info.versionCode > versionCode;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB';
  }
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 10
    ? `${Math.round(megabytes)} MB`
    : `${megabytes.toFixed(1)} MB`;
}
