import type { BuiltInPatternId } from '../types';

export type PatternDefinition = {
  id: string;
  label: string;
  description: string;
  timings: number[];
  amplitudes?: number[];
};

export const BUILT_IN_PATTERNS: Record<BuiltInPatternId, PatternDefinition> = {
  tap: {
    id: 'tap',
    label: 'Tap',
    description: 'One clean pulse',
    timings: [0, 220],
    amplitudes: [0, 220],
  },
  double: {
    id: 'double',
    label: 'Double',
    description: 'Two quick taps',
    timings: [0, 130, 110, 130],
    amplitudes: [0, 200, 0, 200],
  },
  wave: {
    id: 'wave',
    label: 'Wave',
    description: 'A long, rolling buzz',
    timings: [0, 80, 70, 160, 80, 320],
    amplitudes: [0, 120, 0, 180, 0, 255],
  },
  heartbeat: {
    id: 'heartbeat',
    label: 'Heartbeat',
    description: 'Two soft thumps, then rest',
    timings: [0, 90, 120, 140, 620, 90, 120, 140],
    amplitudes: [0, 140, 0, 235, 0, 140, 0, 235],
  },
  ripple: {
    id: 'ripple',
    label: 'Ripple',
    description: 'A pulse that fades away',
    timings: [0, 60, 60, 70, 70, 80, 80, 90, 90, 100],
    amplitudes: [0, 255, 0, 210, 0, 165, 0, 120, 0, 75],
  },
  sos: {
    id: 'sos',
    label: 'SOS',
    description: 'Three short, three long, three short',
    timings: [
      0, 120, 100, 120, 100, 120, 220, 340, 100, 340, 100, 340, 220, 120, 100,
      120, 100, 120,
    ],
    amplitudes: [
      0, 240, 0, 240, 0, 240, 0, 255, 0, 255, 0, 255, 0, 240, 0, 240, 0, 240,
    ],
  },
  long: {
    id: 'long',
    label: 'Long',
    description: 'One steady, insistent hum',
    timings: [0, 1200],
    amplitudes: [0, 255],
  },
};

export const BUILT_IN_KEYS: BuiltInPatternId[] = [
  'tap',
  'double',
  'wave',
  'heartbeat',
  'ripple',
  'sos',
  'long',
];

export const DEFAULT_BUZZ_PATTERN: BuiltInPatternId = 'tap';

const BUILT_IN_SET = new Set<string>(BUILT_IN_KEYS);

export function isBuiltInPattern(value: unknown): value is BuiltInPatternId {
  return typeof value === 'string' && BUILT_IN_SET.has(value);
}

export function toBuzzPattern(value: unknown): BuiltInPatternId {
  return isBuiltInPattern(value) ? value : DEFAULT_BUZZ_PATTERN;
}

export function patternFor(value: unknown): PatternDefinition {
  return BUILT_IN_PATTERNS[toBuzzPattern(value)];
}

export function patternTimings(pattern: unknown): number[] {
  return [...patternFor(pattern).timings];
}

export function patternAmplitudes(pattern: unknown): number[] | undefined {
  const amplitudes = patternFor(pattern).amplitudes;
  return amplitudes ? [...amplitudes] : undefined;
}

export const MAX_PATTERN_STEPS = 40;
export const MAX_PATTERN_VALUE_MS = 10_000;

export function sanitizeTimings(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const timings: number[] = [];
  for (const entry of value.slice(0, MAX_PATTERN_STEPS)) {
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0) {
      return null;
    }
    timings.push(Math.min(MAX_PATTERN_VALUE_MS, Math.round(entry)));
  }
  return timings.length >= 2 && timings[0] === 0 ? timings : null;
}

export function sanitizeAmplitudes(
  value: unknown,
  length: number,
): number[] | undefined {
  if (!Array.isArray(value) || value.length !== length) {
    return undefined;
  }
  const amplitudes: number[] = [];
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0) {
      return undefined;
    }
    amplitudes.push(Math.max(0, Math.min(255, Math.round(entry))));
  }
  return amplitudes;
}

export function buildCustomTimings(
  pulses: number,
  pulseMs: number,
  gapMs: number,
): { timings: number[]; amplitudes: number[] } {
  const count = Math.max(1, Math.min(8, Math.round(pulses)));
  const on = Math.max(40, Math.min(600, Math.round(pulseMs)));
  const off = Math.max(30, Math.min(800, Math.round(gapMs)));
  const timings: number[] = [0];
  const amplitudes: number[] = [0];
  for (let index = 0; index < count; index += 1) {
    timings.push(on);
    amplitudes.push(255);
    if (index < count - 1) {
      timings.push(off);
      amplitudes.push(0);
    }
  }
  return { timings, amplitudes };
}

export function scaledAmplitudes(
  amplitudes: number[],
  strength: number,
): number[] {
  const factor = Math.max(0.1, Math.min(1, strength));
  return amplitudes.map(value =>
    value === 0 ? 0 : Math.round(value * factor),
  );
}
