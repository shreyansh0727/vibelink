import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';
import type { IncomingPulse } from '../types';

export function IncomingBanner({ pulse }: { pulse: IncomingPulse | null }) {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulse) {
      return;
    }
    reveal.setValue(0);
    Animated.spring(reveal, {
      toValue: 1,
      speed: 18,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [pulse, reveal]);

  if (!pulse) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
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
        <View style={styles.icon}>
          <View style={styles.iconBarShort} />
          <View style={styles.iconBarTall} />
          <View style={styles.iconBarMid} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>PULSE RECEIVED</Text>
          <Text numberOfLines={1} style={styles.title}>
            {pulse.label} from {pulse.fromName}
          </Text>
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
      zIndex: 100,
      elevation: 20,
      alignItems: 'center',
      paddingHorizontal: 18,
    },
    banner: {
      width: '100%',
      maxWidth: 520,
      minHeight: 66,
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.accentLine,
      backgroundColor: colors.surfaceRaised,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: spacing.medium,
      paddingVertical: 12,
      shadowColor: colors.black,
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2.5,
    },
    iconBarShort: {
      width: 2.5,
      height: 7,
      borderRadius: 2,
      backgroundColor: colors.accentInk,
    },
    iconBarTall: {
      width: 2.5,
      height: 16,
      borderRadius: 2,
      backgroundColor: colors.accentInk,
    },
    iconBarMid: {
      width: 2.5,
      height: 11,
      borderRadius: 2,
      backgroundColor: colors.accentInk,
    },
    copy: {
      flex: 1,
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
      fontSize: 14,
      fontWeight: '600',
    },
  });
