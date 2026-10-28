import { NativeModules, Platform, Vibration } from 'react-native';
import {
  patternFor,
  sanitizeAmplitudes,
  sanitizeTimings,
} from './patterns';

type NativeVibrator = {
  vibrate(timings: number[], amplitudes?: number[]): void;
};

const nativeVibrator = NativeModules.VibeLinkVibrator as
  | NativeVibrator
  | undefined;

export function playTimings(timings: number[], amplitudes?: number[]): void {
  if (Platform.OS !== 'android') {
    return;
  }

  const safeTimings = sanitizeTimings(timings);
  if (!safeTimings) {
    return;
  }
  const safeAmplitudes = amplitudes
    ? sanitizeAmplitudes(amplitudes, safeTimings.length)
    : undefined;

  if (nativeVibrator) {
    nativeVibrator.vibrate(safeTimings, safeAmplitudes);
    return;
  }
  Vibration.vibrate(safeTimings, false);
}

export function playHaptic(pattern: unknown): void {
  const definition = patternFor(pattern);
  playTimings(definition.timings, definition.amplitudes);
}

export type BuzzPayload = {
  pattern?: unknown;
  timings?: unknown;
  amplitudes?: unknown;
};

function parseList(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function buzzWaveform(
  payload: BuzzPayload | string | undefined,
): { timings: number[]; amplitudes?: number[] } {
  if (payload === undefined || typeof payload === 'string') {
    const definition = patternFor(payload);
    return { timings: definition.timings, amplitudes: definition.amplitudes };
  }

  const timings = sanitizeTimings(parseList(payload.timings));
  if (timings) {
    return {
      timings,
      amplitudes: sanitizeAmplitudes(
        parseList(payload.amplitudes),
        timings.length,
      ),
    };
  }

  const definition = patternFor(payload.pattern);
  return { timings: definition.timings, amplitudes: definition.amplitudes };
}

export function vibrateBuzz(payload: BuzzPayload | string | undefined): void {
  const { timings, amplitudes } = buzzWaveform(payload);
  playTimings(timings, amplitudes);
}

export function playPressFeedback(): void {
  if (Platform.OS === 'android') {
    Vibration.vibrate(12);
  }
}
