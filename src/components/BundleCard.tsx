import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { AppBundle } from '../hooks/useOtaUpdate';
import { formatBytes } from '../lib/updateInfo';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';

export function BundleCard({ bundle }: { bundle: AppBundle }) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const { available, info, state, phase, progress, error } = bundle;

  if (!available) {
    return (
      <View style={styles.card}>
        <Text style={styles.description}>
          In-app JS updates need the Android build of VibeLink.
        </Text>
      </View>
    );
  }

  const busy = phase === 'checking' || phase === 'downloading';
  const total = progress && progress.totalBytes > 0
    ? progress.totalBytes
    : info?.sizeBytes ?? 0;
  const ratio =
    progress && total > 0
      ? Math.min(1, progress.downloadedBytes / total)
      : 0;
  const percent = Math.round(ratio * 100);
  const fillWidth = `${percent}%` as `${number}%`;

  const runningLabel = state?.runningVersion
    ? `${state.runningVersion} · JS bundle`
    : 'Built-in bundle';

  let status: string;
  switch (phase) {
    case 'checking':
      status = 'Checking for a newer JS bundle…';
      break;
    case 'downloading':
      status =
        progress?.status === 'verifying'
          ? 'Checking the downloaded bundle…'
          : `Downloading… ${percent}%`;
      break;
    case 'available':
      status = info
        ? `JS bundle ${info.versionName} is ready (${formatBytes(
            info.sizeBytes,
          )}). No new APK needed.`
        : 'A newer JS bundle is available.';
      break;
    case 'pending':
      status = state?.pendingVersion
        ? `JS bundle ${state.pendingVersion} is ready. Restart VibeLink to apply it.`
        : 'A JS bundle is ready. Restart VibeLink to apply it.';
      break;
    case 'error':
      status = error ?? 'The JS bundle check failed.';
      break;
    case 'current':
      status = 'This phone is on the newest JS bundle for its build.';
      break;
    default:
      status = "JS bundles update VibeLink's screens and feels without a new APK.";
  }

  let primary: { label: string; onPress: () => void } | null = null;
  if (phase === 'available') {
    primary = {
      label: `Get ${info?.versionName ?? 'JS bundle'}`,
      onPress: bundle.install,
    };
  } else if (phase === 'pending') {
    primary = { label: 'Restart and apply', onPress: bundle.restart };
  } else if (phase === 'error') {
    primary = {
      label: 'Try again',
      onPress: info ? bundle.install : bundle.check,
    };
  }

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.copy}>
          <Text style={styles.label}>{runningLabel}</Text>
          <Text style={styles.description}>{status}</Text>
        </View>
        {busy ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {phase === 'downloading' ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: fillWidth }]} />
        </View>
      ) : null}

      {info?.notes && phase === 'available' ? (
        <Text style={styles.notes}>{info.notes}</Text>
      ) : null}

      {state?.rejectedId ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            JS bundle {state.rejectedVersion ?? state.rejectedId} stopped
            VibeLink from starting, so it was removed. This phone is back on the
            built-in bundle.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss the failed JS bundle notice"
            hitSlop={8}
            onPress={bundle.dismissRejected}
          >
            <Text style={styles.linkLabel}>Dismiss</Text>
          </Pressable>
        </View>
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
        {phase === 'pending' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Discard the downloaded JS bundle"
            disabled={busy}
            hitSlop={8}
            onPress={bundle.discard}
          >
            <Text style={[styles.checkLabel, busy ? styles.disabled : null]}>
              Discard download
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check for a newer JS bundle"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            hitSlop={8}
            onPress={bundle.check}
          >
            <Text style={[styles.checkLabel, busy ? styles.disabled : null]}>
              Check again
            </Text>
          </Pressable>
        )}
        {state?.runningId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restart on the built-in bundle"
            disabled={busy}
            hitSlop={8}
            onPress={bundle.useBuiltIn}
          >
            <Text style={[styles.checkLabel, busy ? styles.disabled : null]}>
              Use built-in
            </Text>
          </Pressable>
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
    warning: {
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surfaceRaised,
      padding: 10,
      gap: 6,
    },
    warningText: {
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
    linkLabel: {
      ...type.label,
      fontSize: 12,
      color: colors.accent,
    },
    disabled: {
      opacity: 0.45,
    },
  });
