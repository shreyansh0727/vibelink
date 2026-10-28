import {
  PAIR_CODE_LENGTH,
  cleanPairCodeInput,
  encodePairCode,
  formatPairCode,
  generatePairCode,
  isValidPairCode,
  normalizePairCode,
} from '../src/lib/pairingCode';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

describe('pairing codes', () => {
  it('maps random bytes onto the unambiguous alphabet', () => {
    const bytes = Uint8Array.from(
      { length: PAIR_CODE_LENGTH },
      (_, index) => index * 7,
    );

    const code = encodePairCode(bytes);

    expect(code).toHaveLength(PAIR_CODE_LENGTH);
    for (let index = 0; index < code.length; index += 1) {
      expect(code[index]).toBe(ALPHABET[bytes[index] % ALPHABET.length]);
    }
  });

  it('refuses to build a code from too few bytes', () => {
    expect(() => encodePairCode(new Uint8Array(PAIR_CODE_LENGTH - 1))).toThrow(
      'eight random bytes',
    );
  });

  it('generates a valid code from the platform crypto source', () => {
    const first = generatePairCode();
    const second = generatePairCode();

    expect(isValidPairCode(first)).toBe(true);
    expect(isValidPairCode(second)).toBe(true);
    expect(first).not.toBe(second);
  });

  it('strips separators and casing when normalizing', () => {
    expect(normalizePairCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizePairCode('abcd efgh 2345')).toBe('ABCDEFGH');
  });

  it('drops characters that are not in the alphabet', () => {
    expect(cleanPairCodeInput('ab0i1Ocd')).toBe('ABCD');
    expect(cleanPairCodeInput(' ab-cd/ef!gh ')).toBe('ABCDEFGH');
  });

  it('only accepts complete codes from the alphabet', () => {
    expect(isValidPairCode('ABCDEFGH')).toBe(true);
    expect(isValidPairCode('abcdEFGH')).toBe(false);
    expect(isValidPairCode('ABCDEFG')).toBe(false);
    expect(isValidPairCode('ABCDEFGI')).toBe(false);
    expect(isValidPairCode('ABCDEFG0')).toBe(false);
  });

  it('groups a code for display', () => {
    expect(formatPairCode('ABCDEFGH')).toBe('ABCD EFGH');
    expect(formatPairCode('abcd-efgh')).toBe('ABCD EFGH');
    expect(formatPairCode('')).toBe('');
  });
});
