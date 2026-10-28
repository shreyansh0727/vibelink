import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { Header } from './Brand';
import { BackgroundAccessCard } from './BackgroundAccessCard';
import { PrimaryButton } from './Buttons';
import { CodeDisplay } from './CodeDisplay';
import { RoundButton } from '../ui/RoundButton';
import { Screen } from './Screen';
import { StatusPill } from './StatusPill';
import { Text } from '../ui/Text';
import { formatPairCode } from '../lib/pairingCode';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

type WaitingScreenProps = {
  code: string;
  deviceName: string;
  onLeave: () => Promise<void>;
  onOpenSettings: () => void;
  onOpenHaptics: () => void;
};

function WaitingRadar() {
  const { styles } = useThemedStyles(makeStyles);
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = [ringA, ringB].map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 900),
          Animated.timing(value, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay((1 - index) * 900),
        ]),
      ),
    );

    loops.forEach(loop => loop.start());
    return () => {
      loops.forEach(loop => loop.stop());
    };
  }, [ringA, ringB]);

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0, 0.55, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.65, 1.5],
        }),
      },
    ],
  });

  return (
    <View style={styles.radar}>
      <Animated.View style={[styles.radarRing, ringStyle(ringA)]} />
      <Animated.View style={[styles.radarRing, ringStyle(ringB)]} />
      <View style={styles.radarCore}>
        <View style={styles.radarDot} />
      </View>
    </View>
  );
}

export function WaitingScreen({
  code,
  deviceName,
  onLeave,
  onOpenSettings,
  onOpenHaptics,
}: WaitingScreenProps) {
  const { styles } = useThemedStyles(makeStyles);
  const [leaving, setLeaving] = useState(false);

  const handleShare = () => {
    Share.share({
      message: `Pair with me on VibeLink. Open the app, tap "I have a code", and enter ${formatPairCode(code)}.`,
    }).catch(() => {});
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await onLeave();
    } catch (error) {
      setLeaving(false);
      Alert.alert(
        'Could not leave the pair',
        error instanceof Error
          ? error.message
          : 'Check your connection and try again.',
      );
    }
  };

  const confirmLeave = () => {
    Alert.alert(
      'Cancel this pairing?',
      'This phone will stop waiting for other phones.',
      [
        { text: 'Keep waiting', style: 'cancel' },
        {
          text: 'Cancel pairing',
          style: 'destructive',
          onPress: () => {
            handleLeave();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Header
        right={
          <View style={styles.headerActions}>
            <RoundButton
              accessibilityLabel="Open haptic lab"
              kind="wave"
              onPress={onOpenHaptics}
            />
            <RoundButton
              accessibilityLabel="Open settings"
              kind="more"
              onPress={onOpenSettings}
            />
          </View>
        }
      />

      <View style={styles.hero}>
        <View style={styles.heroHead}>
          <Text style={styles.eyebrow}>PAIRING OPEN</Text>
          <StatusPill label="Waiting" tone="waiting" />
        </View>
        <Text style={styles.title}>
          Now let the{'\n'}other phones in.
        </Text>
        <Text style={styles.body}>
          On each Android phone, open VibeLink and tap “I have a code.” Enter
          the code below. Up to eight phones can share one link.
        </Text>
      </View>

      <View style={styles.codeWrap}>
        <CodeDisplay code={code} />
      </View>

      <View style={styles.waitingCard}>
        <WaitingRadar />
        <View style={styles.waitingCopy}>
          <Text style={styles.waitingTitle}>Listening for linked phones</Text>
          <Text style={styles.waitingBody}>
            Keep this screen open for a moment. You’ll move ahead automatically
            when a phone joins.
          </Text>
        </View>
      </View>

      <BackgroundAccessCard />

      <View style={styles.spacer} />

      <PrimaryButton
        label="Share the code"
        onPress={handleShare}
        style={styles.shareButton}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel pairing"
        disabled={leaving}
        hitSlop={8}
        onPress={confirmLeave}
        style={({ pressed }) => [
          styles.cancelButton,
          pressed ? styles.cancelButtonPressed : null,
        ]}
      >
        <Text style={styles.cancelText}>
          {leaving ? 'Cancelling…' : 'Cancel pairing'}
        </Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footnote}>
          THE CODE IS THE KEY · SHARE IT ONLY WITH TRUSTED PHONES
        </Text>
        <Text style={styles.deviceLine}>THIS PHONE · {deviceName}</Text>
      </View>
    </Screen>
  );
}

const makeStyles = ({ colors, radii, spacing, type }: AppTheme) =>
  StyleSheet.create({
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    hero: {
      marginTop: 34,
      gap: spacing.medium,
    },
    heroHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    eyebrow: {
      ...type.eyebrow,
      color: colors.accent,
    },
    title: {
      ...type.display,
      fontSize: 42,
      lineHeight: 45,
      color: colors.text,
    },
    body: {
      ...type.body,
      color: colors.textMuted,
      maxWidth: 410,
    },
    codeWrap: {
      marginTop: 30,
    },
    waitingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginTop: spacing.medium,
      padding: spacing.medium,
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    radar: {
      width: 52,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radarRing: {
      position: 'absolute',
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    radarCore: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accentWash,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radarDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    waitingCopy: {
      flex: 1,
      gap: 4,
    },
    waitingTitle: {
      ...type.label,
      color: colors.text,
    },
    waitingBody: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    spacer: {
      flexGrow: 1,
      minHeight: 28,
    },
    shareButton: {
      marginTop: spacing.small,
    },
    cancelButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.small,
    },
    cancelButtonPressed: {
      opacity: 0.6,
    },
    cancelText: {
      ...type.label,
      color: colors.textMuted,
    },
    footer: {
      paddingTop: spacing.medium,
      alignItems: 'center',
      gap: spacing.small,
    },
    footnote: {
      ...type.eyebrow,
      fontSize: 8,
      letterSpacing: 1.2,
      color: colors.textFaint,
      textAlign: 'center',
    },
    deviceLine: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.5,
      color: colors.textFaint,
      opacity: 0.75,
    },
  });
