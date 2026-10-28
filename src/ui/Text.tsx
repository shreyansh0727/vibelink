import React from 'react';
import { StyleSheet, Text as NativeText } from 'react-native';
import type { TextProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function Text({ style, ...rest }: TextProps) {
  const { theme } = useTheme();
  const flat = StyleSheet.flatten(style) ?? {};
  const scaledSize =
    typeof flat.fontSize === 'number'
      ? flat.fontSize * theme.fontScale
      : undefined;
  const scaledLineHeight =
    typeof flat.lineHeight === 'number' && scaledSize !== undefined
      ? flat.lineHeight * theme.fontScale
      : undefined;

  return (
    <NativeText
      {...rest}
      style={[
        style,
        {
          fontFamily: flat.fontFamily ?? theme.fontFamily,
          ...(scaledSize !== undefined
            ? { fontSize: scaledSize, lineHeight: scaledLineHeight }
            : null),
        },
      ]}
    />
  );
}
