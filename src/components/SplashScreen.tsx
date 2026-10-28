import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { Screen } from './Screen';
import { Text } from '../ui/Text';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

export function SplashScreen({ label }: { label: string }) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.mark,
            {
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.055],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.bar, styles.barShort]} />
          <View style={[styles.bar, styles.barTall]} />
          <View style={[styles.bar, styles.barMid]} />
          <View style={[styles.bar, styles.barTiny]} />
        </Animated.View>
        <Text style={styles.wordmark}>VIBELINK</Text>
        <Text style={styles.tagline}>A quiet line between two phones.</Text>
        <ActivityIndicator
          color={colors.accent}
          size="small"
          style={styles.spinner}
        />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.footer}>SILENT DELIVERY · NO NOTIFICATIONS</Text>
    </Screen>
  );
}

const makeStyles = ({ colors, spacing, type }: AppTheme) =>
  StyleSheet.create({
    content: {
      alignItems: 'stretch',
      justifyContent: 'space-between',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: spacing.huge,
    },
    mark: {
      width: 74,
      height: 74,
      borderRadius: 23,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      shadowColor: colors.accent,
      shadowOpacity: 0.2,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    bar: {
      width: 4,
      borderRadius: 3,
      backgroundColor: colors.accentInk,
    },
    barShort: {
      height: 14,
    },
    barTall: {
      height: 36,
    },
    barMid: {
      height: 24,
    },
    barTiny: {
      height: 10,
    },
    wordmark: {
      marginTop: 28,
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 4.5,
    },
    tagline: {
      marginTop: 10,
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },
    spinner: {
      marginTop: 42,
    },
    label: {
      marginTop: spacing.medium,
      ...type.eyebrow,
      color: colors.textFaint,
      textAlign: 'center',
    },
    footer: {
      ...type.eyebrow,
      fontSize: 8,
      letterSpacing: 1.5,
      color: colors.textFaint,
      textAlign: 'center',
    },
  });
