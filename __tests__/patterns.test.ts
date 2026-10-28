import {
  BUILT_IN_KEYS,
  BUILT_IN_PATTERNS,
  DEFAULT_BUZZ_PATTERN,
  buildCustomTimings,
  isBuiltInPattern,
  patternTimings,
  sanitizeTimings,
  scaledAmplitudes,
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
    expect(BUILT_IN_KEYS).toHaveLength(7);
    expect(BUILT_IN_PATTERNS.heartbeat.label).toBe('Heartbeat');
    expect(BUILT_IN_PATTERNS.sos.timings.length).toBeGreaterThan(10);
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
  it('builds an alternating timeline for the requested pulse count', () => {
    const { timings, amplitudes } = buildCustomTimings(3, 200, 100);

    expect(timings).toEqual([0, 200, 100, 200, 100, 200]);
    expect(amplitudes).toEqual([0, 255, 0, 255, 0, 255]);
  });

  it('clamps the pulse count into a safe range', () => {
    expect(buildCustomTimings(0, 100, 100).timings).toEqual([0, 100]);
    expect(buildCustomTimings(99, 100, 100).timings).toHaveLength(
      1 + 8 * 2 - 1,
    );
  });

  it('scales amplitudes without lighting up silent gaps', () => {
    expect(scaledAmplitudes([0, 200, 0, 100], 0.5)).toEqual([0, 100, 0, 50]);
  });

  it('rejects malformed timelines from the network', () => {
    expect(sanitizeTimings([0, 100])).toEqual([0, 100]);
    expect(sanitizeTimings([100, 100])).toBeNull();
    expect(sanitizeTimings([0, -5])).toBeNull();
    expect(sanitizeTimings('0,100')).toBeNull();
    expect(sanitizeTimings([0])).toBeNull();
  });
});
