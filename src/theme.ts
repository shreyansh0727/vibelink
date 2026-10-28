export const colors = {
  background: '#090A0C',
  surface: '#121419',
  surfaceRaised: '#181B21',
  surfaceSoft: '#1D2027',
  line: '#282C34',
  lineStrong: '#3A3F49',
  text: '#F2F4EC',
  textMuted: '#8F96A1',
  textFaint: '#5C626D',
  accent: '#D3FA4A',
  accentPressed: '#C1E83D',
  accentInk: '#101303',
  accentWash: 'rgba(211, 250, 74, 0.10)',
  accentLine: 'rgba(211, 250, 74, 0.28)',
  green: '#7FE3A5',
  coral: '#FF8A6B',
  danger: '#FF6E6E',
  white: '#FFFFFF',
  black: '#050604',
} as const;

export const radii = {
  small: 12,
  medium: 18,
  large: 26,
  xlarge: 34,
  pill: 999,
} as const;

export const spacing = {
  xsmall: 6,
  small: 10,
  medium: 16,
  large: 24,
  xlarge: 32,
  huge: 48,
} as const;

export const type = {
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 2.2,
    textTransform: 'uppercase' as const,
  },
  display: {
    fontSize: 46,
    lineHeight: 49,
    fontWeight: '700' as const,
    letterSpacing: -1.9,
  },
  title: {
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '700' as const,
    letterSpacing: -1.1,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  button: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.1,
  },
  mono: {
    fontFamily: 'monospace',
    fontWeight: '700' as const,
  },
};
