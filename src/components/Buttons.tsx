import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Text } from '../ui/Text';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { styles, colors } = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.accentInk} />
      ) : (
        <>
          <Text style={styles.primaryLabel}>{label}</Text>
          <Text style={styles.arrow}>→</Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { styles, colors } = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles.secondary,
        pressed && !disabled ? styles.secondaryPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={styles.secondaryLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  disabled = false,
  style,
}: Omit<ButtonProps, 'loading'>) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.textButton,
        pressed && !disabled ? styles.textButtonPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = ({ colors, radii, spacing, type }: AppTheme) =>
  StyleSheet.create({
    button: {
      minHeight: 58,
      borderRadius: radii.medium,
      paddingHorizontal: spacing.large,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.small,
    },
    primaryLabel: {
      ...type.button,
      color: colors.accentInk,
    },
    arrow: {
      color: colors.accentInk,
      fontSize: 22,
      lineHeight: 24,
      fontWeight: '500',
      marginTop: -1,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    secondaryPressed: {
      backgroundColor: colors.surfaceRaised,
      transform: [{ scale: 0.99 }],
    },
    secondaryLabel: {
      ...type.button,
      color: colors.text,
    },
    pressed: {
      backgroundColor: colors.accentPressed,
      transform: [{ scale: 0.99 }],
    },
    disabled: {
      opacity: 0.45,
    },
    textButton: {
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.small,
    },
    textButtonPressed: {
      opacity: 0.65,
    },
    textButtonLabel: {
      ...type.label,
      color: colors.textMuted,
    },
  });
