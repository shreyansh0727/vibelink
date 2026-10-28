import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useBackgroundAccess } from '../hooks/useBackgroundAccess';
import {
  backgroundAccessLevel,
  standbyBucketLabel,
  vendorHint,
} from '../lib/batteryState';
import type { BackgroundAccessLevel } from '../lib/batteryState';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

const STATE_LABEL: Record<BackgroundAccessLevel, string> = {
  unrestricted: 'Unrestricted',
  optimized: 'Optimized',
  restricted: 'Restricted',
};

const STATE_COPY: Record<BackgroundAccessLevel, string> = {
  unrestricted: 'This phone can wake for pulses with the screen off.',
  optimized:
    'Android may hold pulses until you open the app. Set battery usage to Unrestricted for instant delivery.',
  restricted:
    'Android is blocking background work. Pulses wait until you open VibeLink.',
};

export function BackgroundAccessCard() {
  const { styles, colors } = useThemedStyles(makeStyles);
  const { available, status, loading, opening, allowUnrestricted, openSettings } =
    useBackgroundAccess();

  if (!available) {
    return null;
  }

  const level = backgroundAccessLevel(status);
  const needsAttention = level !== 'unrestricted';
  const hint = status ? vendorHint(status.manufacturer) : null;
  const stateLabel = loading
    ? 'Checking…'
    : level
      ? STATE_LABEL[level]
      : 'Unknown';
  const stateCopy = loading
    ? 'Checking how Android is treating this app.'
    : level
      ? STATE_COPY[level]
      : 'Android did not report a battery state. Open app settings and allow background activity.';
  const stateColor = loading
    ? colors.textMuted
    : level === 'unrestricted'
      ? colors.green
      : level === 'optimized'
        ? colors.accent
        : colors.coral;

  return (
    <View style={[styles.card, needsAttention ? styles.cardAttention : null]}>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: stateColor }]} />
        <Text style={styles.eyebrow}>Background delivery</Text>
        <Text style={[styles.state, { color: stateColor }]}>{stateLabel}</Text>
      </View>

      <Text style={styles.body}>{stateCopy}</Text>

      {needsAttention ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Allow VibeLink to run unrestricted in the background"
          disabled={opening}
          onPress={allowUnrestricted}
          style={({ pressed }) => [
            styles.action,
            pressed && !opening ? styles.actionPressed : null,
            opening ? styles.actionDisabled : null,
          ]}
        >
          <Text style={styles.actionLabel}>
            {opening ? 'Opening settings…' : 'Allow unrestricted'}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open VibeLink app settings"
        hitSlop={8}
        onPress={openSettings}
        style={({ pressed }) => [
          styles.link,
          pressed ? styles.linkPressed : null,
        ]}
      >
        <Text style={styles.linkLabel}>Manage in settings</Text>
      </Pressable>

      {status && status.standbyBucket >= 0 ? (
        <Text style={styles.meta}>
          STANDBY · {standbyBucketLabel(status.standbyBucket).toUpperCase()}
          {status.backgroundRestricted ? ' · BACKGROUND RESTRICTED' : ''}
        </Text>
      ) : null}

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const makeStyles = ({ colors, radii, spacing, type }: AppTheme) =>
  StyleSheet.create({
    card: {
      marginTop: spacing.medium,
      padding: 14,
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      gap: 7,
    },
    cardAttention: {
      borderColor: colors.accentLine,
      backgroundColor: colors.accentWash,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    eyebrow: {
      ...type.eyebrow,
      flex: 1,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.textFaint,
    },
    state: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    body: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    action: {
      minHeight: 44,
      marginTop: 3,
      borderRadius: radii.small,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.medium,
    },
    actionPressed: {
      backgroundColor: colors.accentPressed,
    },
    actionDisabled: {
      opacity: 0.6,
    },
    actionLabel: {
      ...type.label,
      color: colors.accentInk,
    },
    link: {
      alignSelf: 'flex-start',
      paddingVertical: 3,
    },
    linkPressed: {
      opacity: 0.6,
    },
    linkLabel: {
      ...type.label,
      fontSize: 12,
      color: colors.textMuted,
    },
    meta: {
      ...type.eyebrow,
      fontSize: 8,
      letterSpacing: 1.1,
      color: colors.textFaint,
    },
    hint: {
      color: colors.textFaint,
      fontSize: 11,
      lineHeight: 16,
    },
  });
