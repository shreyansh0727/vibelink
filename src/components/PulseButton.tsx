import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

type PulseButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  patternLabel: string;
  partnerName: string;
};

export function PulseButton({
  onPress,
  disabled = false,
  patternLabel,
  partnerName,
}: PulseButtonProps) {
  const { styles } = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const stageSize = Math.min(width - 88, 296);
  const coreSize = Math.round(stageSize * 0.645);
  const ringSize = Math.round(stageSize * 0.7);

  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const ringC = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const rings = [ringA, ringB, ringC];
    const loops = rings.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 820),
          Animated.timing(value, {
            toValue: 1,
            duration: 2500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay((2 - index) * 820),
        ]),
      ),
    );

    loops.forEach(loop => loop.start());
    return () => {
      loops.forEach(loop => loop.stop());
    };
  }, [ringA, ringB, ringC]);

  const setPressed = (pressed: boolean) => {
    Animated.spring(pressScale, {
      toValue: pressed ? 0.955 : 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 3,
    }).start();
  };

  const ringStyle = (value: Animated.Value) => ({
    width: ringSize,
    height: ringSize,
    borderRadius: ringSize / 2,
    opacity: value.interpolate({
      inputRange: [0, 0.16, 1],
      outputRange: [0, 0.5, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.72, 1.3],
        }),
      },
    ],
  });

  return (
    <View
      style={[styles.stage, { width: stageSize, height: stageSize }]}
      accessibilityRole="none"
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, ringStyle(ringA)]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, ringStyle(ringB)]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, ringStyle(ringC)]}
      />

      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Send a ${patternLabel.toLowerCase()} pulse to ${partnerName}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={({ pressed }) => [
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
            },
            pressed && !disabled ? styles.corePressed : null,
            disabled ? styles.coreDisabled : null,
          ]}
        >
          <View style={styles.bars}>
            <View style={[styles.bar, styles.barOne]} />
            <View style={[styles.bar, styles.barTwo]} />
            <View style={[styles.bar, styles.barThree]} />
            <View style={[styles.bar, styles.barFour]} />
          </View>
          <Text style={styles.sendLabel}>SEND</Text>
          <Text style={styles.patternLabel}>{patternLabel.toUpperCase()}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const makeStyles = ({ colors, radii }: AppTheme) =>
  StyleSheet.create({
    stage: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    ring: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    core: {
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colorWithAlpha(colors.accentInk, 0.14),
      shadowColor: colors.accent,
      shadowOpacity: 0.2,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    corePressed: {
      backgroundColor: colors.accentPressed,
    },
    coreDisabled: {
      opacity: 0.62,
    },
    bars: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 48,
      marginBottom: 8,
    },
    bar: {
      width: 5,
      borderRadius: radii.pill,
      backgroundColor: colors.accentInk,
    },
    barOne: {
      height: 17,
    },
    barTwo: {
      height: 35,
    },
    barThree: {
      height: 48,
    },
    barFour: {
      height: 25,
    },
    sendLabel: {
      color: colors.accentInk,
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: 2.4,
    },
    patternLabel: {
      color: colors.accentInk,
      opacity: 0.55,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      marginTop: 4,
    },
  });

function colorWithAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) {
    return hex;
  }
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
