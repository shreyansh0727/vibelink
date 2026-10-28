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
  snap: {
    id: 'snap',
    label: 'Snap',
    description: 'A single razor-sharp pop',
    timings: [0, 45],
    amplitudes: [0, 255],
  },
  knock: {
    id: 'knock',
    label: 'Knock',
    description: 'Two firm knocks, the second softer',
    timings: [0, 70, 105, 55],
    amplitudes: [0, 255, 0, 190],
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
  pendulum: {
    id: 'pendulum',
    label: 'Pendulum',
    description: 'A heavy swing between strong and soft',
    timings: [0, 180, 80, 110, 80, 180, 80, 110],
    amplitudes: [0, 255, 0, 95, 0, 255, 0, 95],
  },
  ripple: {
    id: 'ripple',
    label: 'Ripple',
    description: 'A pulse that fades away',
    timings: [0, 60, 60, 70, 70, 80, 80, 90, 90, 100],
    amplitudes: [0, 255, 0, 210, 0, 165, 0, 120, 0, 75],
  },
  crescendo: {
    id: 'crescendo',
    label: 'Crescendo',
    description: 'Five pulses that build to full power',
    timings: [0, 70, 55, 85, 55, 100, 55, 120, 55, 140],
    amplitudes: [0, 60, 0, 105, 0, 150, 0, 195, 0, 240],
  },
  rain: {
    id: 'rain',
    label: 'Rain',
    description: 'Scattered droplets with uneven spacing',
    timings: [0, 50, 130, 40, 240, 65, 85, 45, 300, 55, 60, 40],
    amplitudes: [0, 140, 0, 90, 0, 180, 0, 110, 0, 160, 0, 95],
  },
  sonar: {
    id: 'sonar',
    label: 'Sonar',
    description: 'One strong ping, then fading echoes',
    timings: [0, 80, 170, 55, 300, 35],
    amplitudes: [0, 255, 0, 165, 0, 95],
  },
  shiver: {
    id: 'shiver',
    label: 'Shiver',
    description: 'A tight, fast tremble',
    timings: [
      0, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35,
      35, 35, 35, 35, 35, 35,
    ],
    amplitudes: [
      0, 110, 0, 90, 0, 130, 0, 95, 0, 120, 0, 85, 0, 115, 0, 100, 0, 125, 0,
      90, 0, 115, 0, 105,
    ],
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
  'knock',
  'snap',
  'wave',
  'heartbeat',
  'pendulum',
  'sonar',
  'ripple',
  'crescendo',
  'rain',
  'shiver',
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

export type RhythmStep = {
  lengthMs: number;
  gapMs: number;
  strength: number;
};

export const MAX_RHYTHM_STEPS = 8;
export const MAX_RHYTHM_REPEAT = 3;
export const MIN_RHYTHM_PULSE_MS = 40;
export const MAX_RHYTHM_PULSE_MS = 600;
export const MIN_RHYTHM_GAP_MS = 30;
export const MAX_RHYTHM_GAP_MS = 800;

function clampMs(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function buildRhythm(
  steps: RhythmStep[],
  repeat: number,
): { timings: number[]; amplitudes: number[] } | null {
  if (steps.length === 0 || steps.length > MAX_RHYTHM_STEPS) {
    return null;
  }
  const passes = Math.max(1, Math.min(MAX_RHYTHM_REPEAT, Math.round(repeat)));
  const pulses = steps.length * passes;
  // Each pulse contributes an "on" segment and, except for the last, an "off".
  if (pulses * 2 > MAX_PATTERN_STEPS) {
    return null;
  }
  const timings: number[] = [0];
  const amplitudes: number[] = [0];
  let played = 0;
  for (let pass = 0; pass < passes; pass += 1) {
    for (const step of steps) {
      timings.push(
        clampMs(step.lengthMs, MIN_RHYTHM_PULSE_MS, MAX_RHYTHM_PULSE_MS),
      );
      amplitudes.push(clampMs(step.strength, 0, 255));
      played += 1;
      if (played < pulses) {
        timings.push(clampMs(step.gapMs, MIN_RHYTHM_GAP_MS, MAX_RHYTHM_GAP_MS));
        amplitudes.push(0);
      }
    }
  }
  return { timings, amplitudes };
}
