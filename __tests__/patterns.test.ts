import {
  BUILT_IN_KEYS,
  BUILT_IN_PATTERNS,
  DEFAULT_BUZZ_PATTERN,
  MAX_RHYTHM_STEPS,
  buildRhythm,
  isBuiltInPattern,
  patternTimings,
  sanitizeTimings,
  toBuzzPattern,
} from '../src/lib/patterns';

describe('buzz patterns', () => {
  it('describes each pattern as an on/off timeline starting at zero', () => {
    for (const key of BUILT_IN_KEYS) {
      const { timings } = BUILT_IN_PATTERNS[key];

      expect(timings.length).toBeGreaterThanOrEqual(2);
      expect(timings.length % 2).toBe(0);
      expect(timings[0]).toBe(0);
      expect(timings.every(ms => Number.isFinite(ms) && ms >= 0)).toBe(true);
    }

    expect(new Set(BUILT_IN_KEYS).size).toBe(BUILT_IN_KEYS.length);
  });

  it('includes the expanded built-in catalog', () => {
    expect(BUILT_IN_KEYS).toHaveLength(14);
    expect(BUILT_IN_PATTERNS.heartbeat.label).toBe('Heartbeat');
    expect(BUILT_IN_PATTERNS.sos.timings.length).toBeGreaterThan(10);
    expect(BUILT_IN_PATTERNS.snap.timings).toEqual([0, 45]);
    expect(BUILT_IN_PATTERNS.crescendo.amplitudes).toEqual([
      0, 60, 0, 105, 0, 150, 0, 195, 0, 240,
    ]);
    expect(BUILT_IN_PATTERNS.shiver.timings.slice(1, 5)).toEqual([
      35, 35, 35, 35,
    ]);
    expect(BUILT_IN_PATTERNS.rain.timings).not.toEqual(
      BUILT_IN_PATTERNS.pendulum.timings,
    );
  });

  it('keeps amplitudes aligned with every built-in timeline', () => {
    for (const key of BUILT_IN_KEYS) {
      const { timings, amplitudes } = BUILT_IN_PATTERNS[key];
      expect(amplitudes).toHaveLength(timings.length);
      for (const amplitude of amplitudes ?? []) {
        expect(Number.isInteger(amplitude)).toBe(true);
        expect(amplitude).toBeGreaterThanOrEqual(0);
        expect(amplitude).toBeLessThanOrEqual(255);
      }
    }
  });

  it('recognizes only the supported pattern names', () => {
    expect(isBuiltInPattern('tap')).toBe(true);
    expect(isBuiltInPattern('long')).toBe(true);
    expect(isBuiltInPattern('custom')).toBe(false);
    expect(isBuiltInPattern(42)).toBe(false);
    expect(isBuiltInPattern(null)).toBe(false);
  });

  it('falls back to the default for unknown messages', () => {
    expect(toBuzzPattern('double')).toBe('double');
    expect(toBuzzPattern('nope')).toBe(DEFAULT_BUZZ_PATTERN);
    expect(toBuzzPattern(undefined)).toBe(DEFAULT_BUZZ_PATTERN);
  });

  it('hands out a copy so callers cannot mutate the preset', () => {
    const timings = patternTimings('tap');
    timings[1] = 9999;

    expect(BUILT_IN_PATTERNS.tap.timings[1]).toBe(220);
  });
});

describe('custom patterns', () => {
  it('builds a per-pulse timeline with its own length, gap and strength', () => {
    const built = buildRhythm(
      [
        { lengthMs: 200, gapMs: 100, strength: 255 },
        { lengthMs: 300, gapMs: 80, strength: 128 },
      ],
      1,
    );

    expect(built).toEqual({
      timings: [0, 200, 100, 300],
      amplitudes: [0, 255, 0, 128],
    });
  });

  it('repeats the whole rhythm and drops the final gap', () => {
    const built = buildRhythm(
      [{ lengthMs: 100, gapMs: 50, strength: 200 }],
      2,
    );

    expect(built).toEqual({
      timings: [0, 100, 50, 100],
      amplitudes: [0, 200, 0, 200],
    });
  });

  it('clamps out-of-range steps and treats junk numbers as the minimum', () => {
    const built = buildRhythm(
      [{ lengthMs: 5, gapMs: 5000, strength: 999 }],
      1,
    );

    expect(built).toEqual({
      timings: [0, 40],
      amplitudes: [0, 255],
    });
    expect(
      buildRhythm([{ lengthMs: NaN, gapMs: NaN, strength: NaN }], 1),
    ).toEqual({ timings: [0, 40], amplitudes: [0, 0] });
  });

  it('refuses rhythms that cannot fit into one waveform', () => {
    const steps = Array.from({ length: MAX_RHYTHM_STEPS }, () => ({
      lengthMs: 200,
      gapMs: 100,
      strength: 200,
    }));

    expect(buildRhythm(steps, 2)).not.toBeNull();
    expect(buildRhythm(steps, 3)).toBeNull();
    expect(buildRhythm([], 1)).toBeNull();
    expect(buildRhythm([...steps, ...steps], 1)).toBeNull();
  });

  it('rejects malformed timelines from the network', () => {
    expect(sanitizeTimings([0, 100])).toEqual([0, 100]);
    expect(sanitizeTimings([100, 100])).toBeNull();
    expect(sanitizeTimings([0, -5])).toBeNull();
    expect(sanitizeTimings('0,100')).toBeNull();
    expect(sanitizeTimings([0])).toBeNull();
  });
});
