import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

type StatusPillProps = {
  label: string;
  tone?: 'live' | 'waiting';
};

export function StatusPill({ label, tone = 'live' }: StatusPillProps) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.pill}>
      <View
        style={[
          styles.dot,
          tone === 'waiting' ? styles.dotWaiting : styles.dotLive,
        ]}
      />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const makeStyles = ({ colors, radii, type }: AppTheme) =>
  StyleSheet.create({
    pill: {
      minHeight: 30,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 11,
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    dotLive: {
      backgroundColor: colors.green,
    },
    dotWaiting: {
      backgroundColor: colors.accent,
    },
    label: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.3,
      color: colors.textMuted,
    },
  });
