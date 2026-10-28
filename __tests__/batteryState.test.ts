import {
  backgroundAccessLevel,
  standbyBucketLabel,
  vendorHint,
} from '../src/lib/batteryState';
import type { BatteryStatus } from '../src/lib/batteryState';

const base: BatteryStatus = {
  ignoringOptimizations: false,
  standbyBucket: 20,
  backgroundRestricted: false,
  manufacturer: 'Google',
  model: 'Pixel',
};

describe('background access', () => {
  it('reports unrestricted only when battery optimizations are ignored', () => {
    expect(
      backgroundAccessLevel({ ...base, ignoringOptimizations: true }),
    ).toBe('unrestricted');
    expect(backgroundAccessLevel(base)).toBe('optimized');
    expect(backgroundAccessLevel(null)).toBeNull();
  });

  it('treats restricted buckets and background restriction as blocked', () => {
    expect(backgroundAccessLevel({ ...base, standbyBucket: 45 })).toBe(
      'restricted',
    );
    expect(backgroundAccessLevel({ ...base, standbyBucket: 50 })).toBe(
      'restricted',
    );
    expect(
      backgroundAccessLevel({
        ...base,
        ignoringOptimizations: true,
        backgroundRestricted: true,
      }),
    ).toBe('restricted');
  });

  it('labels standby buckets and ignores unknown values', () => {
    expect(standbyBucketLabel(5)).toBe('Exempted');
    expect(standbyBucketLabel(20)).toBe('Working set');
    expect(standbyBucketLabel(45)).toBe('Restricted');
    expect(standbyBucketLabel(-1)).toBe('Unknown');
  });

  it('matches manufacturer hints case-insensitively', () => {
    expect(vendorHint('samsung')).toContain('Sleeping apps');
    expect(vendorHint('  Xiaomi ')).toContain('Autostart');
    expect(vendorHint('Google')).toBeNull();
  });
});
