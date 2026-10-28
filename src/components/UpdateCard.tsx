import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { AppUpdate } from '../hooks/useAppUpdate';
import { formatBytes } from '../lib/updateInfo';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';

export function UpdateCard({ update }: { update: AppUpdate }) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const { available, installed, phase, progress, needsPermission, error } =
    update;

  if (!available) {
    return (
      <View style={styles.card}>
        <Text style={styles.description}>
          Updates need the Android build of VibeLink.
        </Text>
      </View>
    );
  }

  const busy = phase === 'checking' || phase === 'downloading';
  const total =
    progress && progress.totalBytes > 0
      ? progress.totalBytes
      : update.update?.sizeBytes ?? 0;
  const ratio =
    progress && total > 0
      ? Math.min(1, progress.downloadedBytes / total)
      : 0;
  const percent = Math.round(ratio * 100);
  const fillWidth = `${percent}%` as `${number}%`;

  let status: string;
  switch (phase) {
    case 'checking':
      status = 'Checking for a newer build…';
      break;
    case 'downloading':
      status =
        progress?.status === 'verifying'
          ? 'Checking the downloaded file…'
          : `Downloading… ${percent}%`;
      break;
    case 'available':
      status = update.update
        ? `Version ${update.update.versionName} is available (${formatBytes(
            update.update.sizeBytes,
          )}).`
        : 'A newer build is available.';
      break;
    case 'ready':
      status = needsPermission
        ? 'Downloaded. Allow installs to finish updating.'
        : 'Downloaded and verified. Ready to install.';
      break;
    case 'error':
      status = error ?? 'The update check failed.';
      break;
    case 'current':
      status = 'You are on the latest version.';
      break;
    default:
      status = 'Version checks run once a day when you open VibeLink.';
  }

  let primary: { label: string; onPress: () => void } | null = null;
  if (phase === 'available') {
    primary = {
      label: `Update to ${update.update?.versionName ?? 'the new build'}`,
      onPress: update.applyUpdate,
    };
  } else if (phase === 'ready') {
    primary = needsPermission
      ? { label: 'Allow installs', onPress: update.allowInstalls }
      : { label: 'Install update', onPress: update.applyUpdate };
  } else if (phase === 'error') {
    primary = {
      label: 'Try again',
      onPress: update.update ? update.applyUpdate : update.checkLatest,
    };
  }

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.copy}>
          <Text style={styles.label}>
            VibeLink {installed?.versionName ?? '…'}
          </Text>
          <Text style={styles.description}>{status}</Text>
        </View>
        {busy ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {phase === 'downloading' ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: fillWidth }]} />
        </View>
      ) : null}

      {update.update?.notes &&
      (phase === 'available' || phase === 'ready') ? (
        <Text style={styles.notes}>{update.update.notes}</Text>
      ) : null}

      {primary ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primary.label}
          onPress={primary.onPress}
          style={({ pressed }) => [
            styles.primary,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.primaryLabel}>{primary.label}</Text>
        </Pressable>
      ) : null}

      <View style={styles.footerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check for updates"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          hitSlop={8}
          onPress={update.checkLatest}
        >
          <Text style={[styles.checkLabel, busy ? styles.disabled : null]}>
            Check for updates
          </Text>
        </Pressable>
        {installed ? (
          <Text style={styles.buildLabel}>BUILD {installed.versionCode}</Text>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = ({ colors, radii, spacing, type }: AppTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 12,
    },
    headRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    copy: {
      flex: 1,
      gap: 3,
    },
    label: {
      ...type.label,
      color: colors.text,
    },
    description: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.lineStrong,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    notes: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    primary: {
      minHeight: 44,
      borderRadius: radii.small,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.medium,
    },
    primaryLabel: {
      ...type.label,
      color: colors.accentInk,
    },
    pressed: {
      opacity: 0.7,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    checkLabel: {
      ...type.label,
      fontSize: 12,
      color: colors.textMuted,
    },
    buildLabel: {
      ...type.eyebrow,
      fontSize: 8,
      letterSpacing: 1.4,
      color: colors.textFaint,
    },
    disabled: {
      opacity: 0.45,
    },
  });
