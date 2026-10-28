// The pair's agreed "language": what each built-in feel means, plus the
// sanitizers used for rhythms shared between linked phones.
import { BUILT_IN_PATTERNS } from './patterns';
import type { BuiltInPatternId, SharedRhythm } from '../types';

export const MAX_MEANING_LENGTH = 32;
export const MAX_SHARED_LABEL_LENGTH = 24;
export const MAX_SHARED_NAME_LENGTH = 64;
export const MAX_SHARED_TIMINGS = 41;
export const MAX_SHARED_TOTAL_MS = 30_000;

export const DEFAULT_MEANINGS: Record<BuiltInPatternId, string> = {
  tap: 'Yes',
  double: 'No',
  snap: 'Now',
  knock: 'Come here',
  wave: 'Hello',
  heartbeat: 'Thinking of you',
  pendulum: 'On my way',
  ripple: 'Miss you',
  crescendo: 'Hurry',
  rain: 'Goodnight',
  sonar: 'Where are you?',
  shiver: 'Call me',
  sos: 'Help',
  long: 'Wait',
};

const BUILT_IN_IDS = new Set<string>(Object.keys(BUILT_IN_PATTERNS));

export function isBuiltInPattern(value: string): value is BuiltInPatternId {
  return BUILT_IN_IDS.has(value);
}

export function sanitizeMeaning(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().slice(0, MAX_MEANING_LENGTH)
    : '';
}

export function effectiveMeaning(
  patternId: string,
  meanings: Record<string, string>,
): string {
  if (!isBuiltInPattern(patternId)) {
    return '';
  }
  return sanitizeMeaning(meanings[patternId]) || DEFAULT_MEANINGS[patternId];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeTimings(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_SHARED_TIMINGS) {
    return null;
  }
  const timings: number[] = [];
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0) {
      return null;
    }
    timings.push(Math.round(entry));
  }
  if (timings[0] !== 0) {
    return null;
  }
  const total = timings.reduce((sum, entry) => sum + entry, 0);
  if (total > MAX_SHARED_TOTAL_MS) {
    return null;
  }
  return timings;
}

function sanitizeAmplitudes(value: unknown, length: number): number[] | null {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.length === 0) {
    return [];
  }
  if (value.length !== length) {
    return null;
  }
  const amplitudes: number[] = [];
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) {
      return null;
    }
    amplitudes.push(Math.max(0, Math.min(255, Math.round(entry))));
  }
  return amplitudes;
}

export function parseSharedRhythm(
  id: string,
  value: unknown,
): SharedRhythm | null {
  if (!isRecord(value)) {
    return null;
  }
  const from = value.from;
  const fromName = value.fromName;
  const label = sanitizeMeaning(value.label).slice(0, MAX_SHARED_LABEL_LENGTH);
  if (typeof from !== 'string' || !from || !label) {
    return null;
  }
  if (typeof fromName !== 'string') {
    return null;
  }
  const timings = sanitizeTimings(value.timings);
  if (!timings) {
    return null;
  }
  const amplitudes = sanitizeAmplitudes(value.amplitudes, timings.length);
  if (!amplitudes) {
    return null;
  }
  const createdAt =
    typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
      ? value.createdAt
      : 0;
  return {
    id,
    from,
    fromName:
      fromName.trim().slice(0, MAX_SHARED_NAME_LENGTH) || 'A linked phone',
    label,
    timings,
    amplitudes,
    createdAt,
  };
}

export function sameRhythm(
  left: { label: string; timings: number[]; amplitudes: number[] },
  right: { label: string; timings: number[]; amplitudes: number[] },
): boolean {
  if (left.label.trim().toLowerCase() !== right.label.trim().toLowerCase()) {
    return false;
  }
  if (left.timings.length !== right.timings.length) {
    return false;
  }
  if (left.timings.some((value, index) => value !== right.timings[index])) {
    return false;
  }
  if (left.amplitudes.length !== right.amplitudes.length) {
    return false;
  }
  return left.amplitudes.every(
    (value, index) => value === right.amplitudes[index],
  );
}
