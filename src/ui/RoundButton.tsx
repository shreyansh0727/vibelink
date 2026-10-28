import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

type RoundButtonProps = {
  kind: 'back' | 'more' | 'wave';
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function RoundButton({
  kind,
  onPress,
  accessibilityLabel,
  disabled = false,
}: RoundButtonProps) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {kind === 'back' ? (
        <Text style={styles.back}>←</Text>
      ) : kind === 'more' ? (
        <Text style={styles.more}>•••</Text>
      ) : (
        <View style={styles.bars}>
          <View style={[styles.bar, styles.barShort]} />
          <View style={[styles.bar, styles.barTall]} />
          <View style={[styles.bar, styles.barMid]} />
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    button: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    pressed: {
      backgroundColor: colors.surfaceRaised,
    },
    disabled: {
      opacity: 0.4,
    },
    back: {
      color: colors.text,
      fontSize: 20,
      lineHeight: 23,
    },
    more: {
      color: colors.text,
      fontSize: 14,
      letterSpacing: 1,
      marginTop: -4,
    },
    bars: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2.5,
    },
    bar: {
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    barShort: {
      height: 8,
    },
    barTall: {
      height: 16,
    },
    barMid: {
      height: 12,
    },
  });
