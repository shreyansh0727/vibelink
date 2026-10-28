export const PAIR_CODE_LENGTH = 8;

// Enforced by the app before joining; Realtime Database rules cannot count
// children, so the cap is not expressible there.
export const MAX_PAIR_MEMBERS = 8;

// Ambiguous characters are intentionally omitted.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function encodePairCode(bytes: ArrayLike<number>): string {
  if (bytes.length < PAIR_CODE_LENGTH) {
    throw new Error('A pairing code needs eight random bytes.');
  }

  let code = '';
  for (let index = 0; index < PAIR_CODE_LENGTH; index += 1) {
    code += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return code;
}

export function generatePairCode(): string {
  const cryptoObject = (
    globalThis as typeof globalThis & {
      crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
    }
  ).crypto;

  if (!cryptoObject?.getRandomValues) {
    throw new Error('Secure random numbers are unavailable on this device.');
  }

  const bytes = new Uint8Array(PAIR_CODE_LENGTH);
  cryptoObject.getRandomValues(bytes);
  return encodePairCode(bytes);
}

export function normalizePairCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, PAIR_CODE_LENGTH);
}

export function cleanPairCodeInput(input: string): string {
  let cleaned = '';
  for (const character of input.toUpperCase()) {
    if (ALPHABET.includes(character) && cleaned.length < PAIR_CODE_LENGTH) {
      cleaned += character;
    }
  }
  return cleaned;
}

export function isValidPairCode(input: string): boolean {
  if (input.length !== PAIR_CODE_LENGTH) {
    return false;
  }
  for (const character of input) {
    if (!ALPHABET.includes(character)) {
      return false;
    }
  }
  return true;
}

export function formatPairCode(input: string): string {
  const normalized = normalizePairCode(input);
  return `${normalized.slice(0, 4)} ${normalized.slice(4)}`.trim();
}
