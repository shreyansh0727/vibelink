export type BatteryStatus = {
  ignoringOptimizations: boolean;
  standbyBucket: number;
  backgroundRestricted: boolean;
  manufacturer: string;
  model: string;
};

export type BackgroundAccessLevel = 'unrestricted' | 'optimized' | 'restricted';

const RESTRICTED_BUCKETS = new Set([45, 50]);

export function backgroundAccessLevel(
  status: BatteryStatus | null,
): BackgroundAccessLevel | null {
  if (!status) {
    return null;
  }
  if (
    status.backgroundRestricted ||
    RESTRICTED_BUCKETS.has(status.standbyBucket)
  ) {
    return 'restricted';
  }
  return status.ignoringOptimizations ? 'unrestricted' : 'optimized';
}

export function standbyBucketLabel(bucket: number): string {
  switch (bucket) {
    case 5:
      return 'Exempted';
    case 10:
      return 'Active';
    case 20:
      return 'Working set';
    case 30:
      return 'Frequent';
    case 40:
      return 'Rare';
    case 45:
      return 'Restricted';
    case 50:
      return 'Never';
    default:
      return 'Unknown';
  }
}

const VENDOR_HINTS: Record<string, string> = {
  samsung:
    'On Samsung, also set Battery → Background usage limits so VibeLink is not in Sleeping apps or Deep sleeping apps.',
  xiaomi:
    'On Xiaomi, also enable Autostart for VibeLink and set battery saver to No restrictions.',
  oppo: 'On OPPO, also allow Auto launch and set battery optimization to Don’t optimize.',
  realme:
    'On realme, also allow Auto launch and set battery optimization to Don’t optimize.',
  oneplus:
    'On OnePlus, also allow Auto launch and set battery optimization to Don’t optimize.',
  vivo: 'On vivo, also allow Auto-start and high background power usage for VibeLink.',
  iqoo: 'On iQOO, also allow Auto-start and high background power usage for VibeLink.',
  huawei: 'On Huawei, also add VibeLink to protected apps and allow manual launch.',
  honor: 'On Honor, also allow Auto-launch and keep VibeLink running in the background.',
  infinix:
    'On Infinix, also allow Auto-start and disable battery optimization for VibeLink.',
  tecno:
    'On TECNO, also allow Auto-start and disable battery optimization for VibeLink.',
};

export function vendorHint(manufacturer: string): string | null {
  const key = manufacturer.trim().toLowerCase();
  return VENDOR_HINTS[key] ?? null;
}
