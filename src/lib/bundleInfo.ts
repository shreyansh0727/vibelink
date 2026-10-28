export type OtaBundleInfo = {
  id: string;
  versionName: string;
  url: string;
  sha256: string;
  sizeBytes: number;
  minVersionCode: number;
  maxVersionCode: number;
  notes: string;
  publishedAt: number | null;
};

export type OtaState = {
  runningId: string | null;
  runningVersion: string | null;
  pendingId: string | null;
  pendingVersion: string | null;
  rejectedId: string | null;
  rejectedVersion: string | null;
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export function parseBundleInfo(value: unknown): OtaBundleInfo | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, versionName, url, sha256, sizeBytes, notes } = value;
  if (typeof id !== 'string' || !SAFE_ID.test(id)) {
    return null;
  }
  if (typeof versionName !== 'string' || versionName.trim() === '') {
    return null;
  }
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
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
  const minVersionCode = positiveInteger(value.minVersionCode);
  const maxVersionCode = positiveInteger(value.maxVersionCode);
  if (
    minVersionCode === null ||
    maxVersionCode === null ||
    maxVersionCode < minVersionCode
  ) {
    return null;
  }
  return {
    id,
    versionName: versionName.trim(),
    url,
    sha256: sha256.toLowerCase(),
    sizeBytes,
    minVersionCode,
    maxVersionCode,
    notes: typeof notes === 'string' ? notes.trim() : '',
    publishedAt:
      typeof value.publishedAt === 'number' &&
      Number.isFinite(value.publishedAt)
        ? value.publishedAt
        : null,
  };
}

export function bundleApplies(
  info: OtaBundleInfo,
  versionCode: number,
): boolean {
  return (
    versionCode >= info.minVersionCode && versionCode <= info.maxVersionCode
  );
}

export function isBundleCurrent(info: OtaBundleInfo, state: OtaState): boolean {
  return info.id === state.runningId || info.id === state.pendingId;
}
