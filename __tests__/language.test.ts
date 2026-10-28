import {
  DEFAULT_MEANINGS,
  MAX_MEANING_LENGTH,
  effectiveMeaning,
  isBuiltInPattern,
  parseSharedRhythm,
  sameRhythm,
  sanitizeMeaning,
} from '../src/lib/language';

describe('pair legend', () => {
  it('recognises built-in patterns only', () => {
    expect(isBuiltInPattern('tap')).toBe(true);
    expect(isBuiltInPattern('c_abc')).toBe(false);
  });

  it('falls back to the default meaning', () => {
    expect(effectiveMeaning('tap', {})).toBe(DEFAULT_MEANINGS.tap);
    expect(effectiveMeaning('tap', { tap: '   ' })).toBe(DEFAULT_MEANINGS.tap);
  });

  it('prefers a saved override', () => {
    expect(effectiveMeaning('double', { double: ' Not now ' })).toBe(
      'Not now',
    );
  });

  it('ignores meanings for custom rhythms', () => {
    expect(effectiveMeaning('c_abc', { c_abc: 'Hello' })).toBe('');
  });

  it('trims and bounds a meaning', () => {
    expect(sanitizeMeaning('  hi  ')).toBe('hi');
    expect(sanitizeMeaning(42)).toBe('');
    expect(sanitizeMeaning('x'.repeat(80))).toHaveLength(MAX_MEANING_LENGTH);
  });
});

describe('shared rhythms', () => {
  const valid = {
    from: 'uid-1',
    fromName: 'Alex',
    label: 'Triple tap',
    timings: [0, 60, 60, 60, 60, 60],
    amplitudes: [0, 200, 0, 200, 0, 200],
    createdAt: 1700000000000,
  };

  it('parses a valid share', () => {
    const share = parseSharedRhythm('share-1', valid);
    expect(share).toEqual({
      id: 'share-1',
      from: 'uid-1',
      fromName: 'Alex',
      label: 'Triple tap',
      timings: valid.timings,
      amplitudes: valid.amplitudes,
      createdAt: valid.createdAt,
    });
  });

  it('accepts a share without amplitudes', () => {
    const share = parseSharedRhythm('share-1', {
      ...valid,
      amplitudes: undefined,
    });
    expect(share?.amplitudes).toEqual([]);
  });

  it('drops shares with no sender or label', () => {
    expect(parseSharedRhythm('share-1', { ...valid, from: '' })).toBeNull();
    expect(parseSharedRhythm('share-1', { ...valid, label: '  ' })).toBeNull();
    expect(parseSharedRhythm('share-1', null)).toBeNull();
  });

  it('drops malformed timings', () => {
    expect(parseSharedRhythm('x', { ...valid, timings: [0] })).toBeNull();
    expect(parseSharedRhythm('x', { ...valid, timings: [5, 60] })).toBeNull();
    expect(
      parseSharedRhythm('x', { ...valid, timings: [0, 60, 'x'] }),
    ).toBeNull();
    expect(
      parseSharedRhythm('x', { ...valid, timings: [0, ...Array(45).fill(50)] }),
    ).toBeNull();
    expect(
      parseSharedRhythm('x', { ...valid, timings: [0, 20000, 20000] }),
    ).toBeNull();
  });

  it('drops amplitudes that do not match the timings', () => {
    expect(
      parseSharedRhythm('x', { ...valid, amplitudes: [0, 200] }),
    ).toBeNull();
  });

  it('clamps amplitudes into range', () => {
    const share = parseSharedRhythm('x', {
      ...valid,
      timings: [0, 60],
      amplitudes: [0, 999],
    });
    expect(share?.amplitudes).toEqual([0, 255]);
  });
});

describe('sameRhythm', () => {
  const base = { label: 'Triple tap', timings: [0, 60], amplitudes: [0, 200] };

  it('matches labels case-insensitively', () => {
    expect(sameRhythm(base, { ...base, label: 'triple TAP' })).toBe(true);
  });

  it('rejects different timings or amplitudes', () => {
    expect(sameRhythm(base, { ...base, timings: [0, 61] })).toBe(false);
    expect(sameRhythm(base, { ...base, amplitudes: [0, 201] })).toBe(false);
    expect(sameRhythm(base, { ...base, amplitudes: [] })).toBe(false);
  });
});
