import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TextStyle } from 'react-native';
import {
  colors as DEFAULT_COLORS,
  radii as DEFAULT_RADII,
  spacing as DEFAULT_SPACING,
} from '../theme';

export type PaletteId = 'lime' | 'ocean' | 'orchid' | 'ember';
export type ShapeId = 'sharp' | 'soft' | 'round';
export type SizeId = 'compact' | 'standard' | 'large';
export type FontId = 'system' | 'condensed' | 'serif' | 'mono';
export type TextSizeId = 'small' | 'default' | 'large' | 'xlarge';

export type ThemeSettings = {
  palette: PaletteId;
  shape: ShapeId;
  size: SizeId;
  font: FontId;
  textSize: TextSizeId;
};

type ColorKey = keyof typeof DEFAULT_COLORS;
export type ThemeColors = Record<ColorKey, string>;
export type ThemeRadii = Record<keyof typeof DEFAULT_RADII, number>;
export type ThemeSpacing = Record<keyof typeof DEFAULT_SPACING, number>;
export type ThemeType = Record<
  'eyebrow' | 'display' | 'title' | 'body' | 'label' | 'button' | 'mono',
  TextStyle
>;

export type AppTheme = {
  colors: ThemeColors;
  radii: ThemeRadii;
  spacing: ThemeSpacing;
  type: ThemeType;
  fontFamily: string | undefined;
  fontScale: number;
  controlScale: number;
};

export const DEFAULT_SETTINGS: ThemeSettings = {
  palette: 'lime',
  shape: 'soft',
  size: 'standard',
  font: 'system',
  textSize: 'default',
};

export const PALETTE_OPTIONS: Array<{
  id: PaletteId;
  label: string;
  colors: ThemeColors;
}> = [
  { id: 'lime', label: 'Volt', colors: { ...DEFAULT_COLORS } },
  {
    id: 'ocean',
    label: 'Ocean',
    colors: {
      ...DEFAULT_COLORS,
      background: '#061016',
      surface: '#0E1B22',
      surfaceRaised: '#142630',
      surfaceSoft: '#1A303B',
      line: '#223A46',
      lineStrong: '#35535F',
      text: '#ECF7FA',
      textMuted: '#8FA9B3',
      textFaint: '#5A747E',
      accent: '#5FE3F2',
      accentPressed: '#48CDDC',
      accentInk: '#04171B',
      accentWash: 'rgba(95, 227, 242, 0.10)',
      accentLine: 'rgba(95, 227, 242, 0.28)',
      green: '#7FE3A5',
      coral: '#FF8A6B',
      black: '#030B0F',
    },
  },
  {
    id: 'orchid',
    label: 'Orchid',
    colors: {
      ...DEFAULT_COLORS,
      background: '#0A0710',
      surface: '#14101C',
      surfaceRaised: '#1C1726',
      surfaceSoft: '#251E31',
      line: '#332B42',
      lineStrong: '#4A3F5C',
      text: '#F5EEFF',
      textMuted: '#A79BB8',
      textFaint: '#6F637F',
      accent: '#D6A8FF',
      accentPressed: '#C38FF2',
      accentInk: '#1A0A26',
      accentWash: 'rgba(214, 168, 255, 0.10)',
      accentLine: 'rgba(214, 168, 255, 0.28)',
      green: '#86E6B0',
      coral: '#FF9B87',
      black: '#060309',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    colors: {
      ...DEFAULT_COLORS,
      background: '#0D0806',
      surface: '#191110',
      surfaceRaised: '#221917',
      surfaceSoft: '#2C211E',
      line: '#3B2C27',
      lineStrong: '#554139',
      text: '#FDF3EA',
      textMuted: '#B6A096',
      textFaint: '#7A665D',
      accent: '#FFB066',
      accentPressed: '#F09A4A',
      accentInk: '#200F02',
      accentWash: 'rgba(255, 176, 102, 0.10)',
      accentLine: 'rgba(255, 176, 102, 0.30)',
      green: '#8FE0A7',
      coral: '#FF8A6B',
      black: '#080402',
    },
  },
];

const RADII_BY_SHAPE: Record<ShapeId, ThemeRadii> = {
  sharp: { small: 6, medium: 10, large: 14, xlarge: 20, pill: 999 },
  soft: { ...DEFAULT_RADII },
  round: { small: 18, medium: 26, large: 38, xlarge: 50, pill: 999 },
};

const SPACING_SCALE: Record<SizeId, number> = {
  compact: 0.88,
  standard: 1,
  large: 1.14,
};

const CONTROL_SCALE: Record<SizeId, number> = {
  compact: 0.94,
  standard: 1,
  large: 1.08,
};

const FONT_FAMILY: Record<FontId, string | undefined> = {
  system: undefined,
  condensed: 'sans-serif-condensed',
  serif: 'serif',
  mono: 'monospace',
};

const TEXT_SCALE: Record<TextSizeId, number> = {
  small: 0.9,
  default: 1,
  large: 1.12,
  xlarge: 1.24,
};

function scaledSpacing(size: SizeId): ThemeSpacing {
  const factor = SPACING_SCALE[size];
  return Object.fromEntries(
    Object.entries(DEFAULT_SPACING).map(([key, value]) => [
      key,
      Math.round(value * factor),
    ]),
  ) as ThemeSpacing;
}

// Sizes stay at their designed values; the Text wrapper applies fontScale once.
function makeType(fontFamily: string | undefined): ThemeType {
  return {
    eyebrow: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 2.2,
      textTransform: 'uppercase',
      fontFamily,
    },
    display: {
      fontSize: 46,
      lineHeight: 49,
      fontWeight: '700',
      letterSpacing: -1.9,
      fontFamily,
    },
    title: {
      fontSize: 32,
      lineHeight: 37,
      fontWeight: '700',
      letterSpacing: -1.1,
      fontFamily,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400',
      letterSpacing: -0.1,
      fontFamily,
    },
    label: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '600',
      fontFamily,
    },
    button: {
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.1,
      fontFamily,
    },
    mono: {
      fontFamily: 'monospace',
      fontWeight: '700',
      fontSize: 16,
    },
  };
}

export function buildTheme(settings: ThemeSettings): AppTheme {
  const palette =
    PALETTE_OPTIONS.find(option => option.id === settings.palette) ??
    PALETTE_OPTIONS[0];
  const fontFamily = FONT_FAMILY[settings.font];
  const fontScale = TEXT_SCALE[settings.textSize];
  return {
    colors: palette.colors,
    radii: RADII_BY_SHAPE[settings.shape],
    spacing: scaledSpacing(settings.size),
    type: makeType(fontFamily),
    fontFamily,
    fontScale,
    controlScale: CONTROL_SCALE[settings.size],
  };
}

const STORAGE_KEY = '@vibelink/theme';

function sanitizeSettings(value: unknown): ThemeSettings {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_SETTINGS;
  }
  const raw = value as Partial<Record<keyof ThemeSettings, unknown>>;
  const pick = <T extends string>(
    key: keyof ThemeSettings,
    allowed: readonly T[],
    fallback: T,
  ): T => {
    const candidate = raw[key];
    return allowed.includes(candidate as T) ? (candidate as T) : fallback;
  };
  return {
    palette: pick(
      'palette',
      PALETTE_OPTIONS.map(option => option.id),
      DEFAULT_SETTINGS.palette,
    ),
    shape: pick('shape', ['sharp', 'soft', 'round'], DEFAULT_SETTINGS.shape),
    size: pick('size', ['compact', 'standard', 'large'], DEFAULT_SETTINGS.size),
    font: pick(
      'font',
      ['system', 'condensed', 'serif', 'mono'],
      DEFAULT_SETTINGS.font,
    ),
    textSize: pick(
      'textSize',
      ['small', 'default', 'large', 'xlarge'],
      DEFAULT_SETTINGS.textSize,
    ),
  };
}

type ThemeContextValue = {
  theme: AppTheme;
  settings: ThemeSettings;
  ready: boolean;
  updateSettings: (patch: Partial<ThemeSettings>) => void;
  resetSettings: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        if (!saved) {
          return;
        }
        try {
          setSettings(sanitizeSettings(JSON.parse(saved)));
        } catch {
          // A corrupt setting falls back to the defaults.
        }
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  const persist = useCallback((next: ThemeSettings) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<ThemeSettings>) => {
      setSettings(current => {
        const next = sanitizeSettings({ ...current, ...patch });
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  const theme = useMemo(() => buildTheme(settings), [settings]);
  const value = useMemo(
    () => ({ theme, settings, ready, updateSettings, resetSettings }),
    [theme, settings, ready, updateSettings, resetSettings],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider.');
  }
  return value;
}

export function useThemedStyles<T>(factory: (theme: AppTheme) => T) {
  const { theme } = useTheme();
  const styles = useMemo(() => factory(theme), [factory, theme]);
  return {
    theme,
    styles,
    colors: theme.colors,
    radii: theme.radii,
    spacing: theme.spacing,
    type: theme.type,
  };
}
