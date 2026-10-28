import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatBytes, type UpdateInfo } from '../lib/updateInfo';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';

export function UpdateBanner({
  update,
  visible,
  onUpdate,
  onDismiss,
}: {
  update: UpdateInfo | null;
  visible: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !update) {
      return;
    }
    reveal.setValue(0);
    Animated.spring(reveal, {
      toValue: 1,
      speed: 18,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [visible, update, reveal]);

  if (!visible || !update) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.layer, { top: insets.top + 10 }]}
    >
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: reveal,
            transform: [
              {
                translateY: reveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>UPDATE AVAILABLE</Text>
          <Text style={styles.title}>VibeLink {update.versionName}</Text>
          <Text numberOfLines={2} style={styles.body}>
            {update.notes ||
              `A newer build is ready (${formatBytes(update.sizeBytes)}).`}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Update to VibeLink ${update.versionName}`}
            onPress={onUpdate}
            style={({ pressed }) => [
              styles.update,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.updateLabel}>Update</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remind me later"
            hitSlop={8}
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.later,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.laterLabel}>Later</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = ({ colors, radii, spacing, type }: AppTheme) =>
  StyleSheet.create({
    layer: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 90,
      elevation: 18,
      alignItems: 'center',
      paddingHorizontal: 18,
    },
    banner: {
      width: '100%',
      maxWidth: 520,
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.accentLine,
      backgroundColor: colors.surfaceRaised,
      gap: 10,
      paddingHorizontal: spacing.medium,
      paddingVertical: 12,
      shadowColor: colors.black,
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    copy: {
      gap: 3,
    },
    eyebrow: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.6,
      color: colors.accent,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    body: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    update: {
      minHeight: 38,
      borderRadius: radii.small,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.medium,
    },
    updateLabel: {
      ...type.label,
      color: colors.accentInk,
    },
    later: {
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: spacing.xsmall,
    },
    laterLabel: {
      ...type.label,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.7,
    },
  });
