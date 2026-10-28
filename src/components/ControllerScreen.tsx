import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { getDatabase, push, ref, set } from '@react-native-firebase/database';
import { BackgroundAccessCard } from './BackgroundAccessCard';
import { Header } from './Brand';
import { PulseButton } from './PulseButton';
import { RoundButton } from '../ui/RoundButton';
import { Screen } from './Screen';
import { Text } from '../ui/Text';
import { useCustomPatterns } from '../hooks/useCustomPatterns';
import { usePrivacy } from '../hooks/usePrivacy';
import { describePairError, isNetworkError } from '../lib/errors';
import { playPressFeedback } from '../lib/haptics';
import {
  BUILT_IN_KEYS,
  BUILT_IN_PATTERNS,
  DEFAULT_BUZZ_PATTERN,
} from '../lib/patterns';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';
import type { PairMember } from '../types';

type ControllerScreenProps = {
  pairId: string;
  uid: string;
  selfName: string;
  partner: PairMember;
  onLeave: () => Promise<void>;
  onOpenSettings: () => void;
  onOpenHaptics: () => void;
};

type SentPulse = {
  label: string;
  at: number;
  triggerId: string;
};

const PENDING_STATUS_MS = 12_000;
const DELIVERED_STATUS_MS = 4_000;

type PatternOption = {
  id: string;
  label: string;
  description: string;
  timings: number[];
  amplitudes?: number[];
  custom: boolean;
};

function glyphHeights(timings: number[]): number[] {
  const heights: number[] = [];
  for (let index = 1; index < timings.length && heights.length < 5; index += 2) {
    heights.push(Math.max(6, Math.min(20, 6 + (timings[index] ?? 0) / 50)));
  }
  return heights.length ? heights : [10];
}

function PatternGlyph({
  timings,
  active,
}: {
  timings: number[];
  active: boolean;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  return (
    <View style={styles.glyph}>
      {glyphHeights(timings).map((height, index) => (
        <View
          key={index}
          style={[
            styles.glyphBar,
            {
              height,
              backgroundColor: active ? colors.accent : colors.textMuted,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function ControllerScreen({
  pairId,
  uid,
  selfName,
  partner,
  onLeave,
  onOpenSettings,
  onOpenHaptics,
}: ControllerScreenProps) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const { patterns } = useCustomPatterns();
  const { state: privacyState } = usePrivacy();
  const options = useMemo<PatternOption[]>(() => {
    const builtIns = BUILT_IN_KEYS.map(key => ({
      id: BUILT_IN_PATTERNS[key].id,
      label: BUILT_IN_PATTERNS[key].label,
      description: BUILT_IN_PATTERNS[key].description,
      timings: BUILT_IN_PATTERNS[key].timings,
      amplitudes: BUILT_IN_PATTERNS[key].amplitudes,
      custom: false,
    }));
    const custom = patterns.map(pattern => ({
      id: pattern.id,
      label: pattern.label,
      description: 'Your saved feel',
      timings: pattern.timings,
      amplitudes: pattern.amplitudes,
      custom: true,
    }));
    return [...builtIns, ...custom];
  }, [patterns]);

  const [selectedId, setSelectedId] = useState<string>(DEFAULT_BUZZ_PATTERN);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<SentPulse | null>(null);
  const [leaving, setLeaving] = useState(false);

  const selected =
    options.find(option => option.id === selectedId) ?? options[0];

  const delivered =
    lastSent !== null && partner.lastDeliveredTrigger === lastSent.triggerId;

  useEffect(() => {
    if (!lastSent) {
      return;
    }
    const timer = setTimeout(
      () => {
        setLastSent(current => (current?.at === lastSent.at ? null : current));
      },
      delivered ? DELIVERED_STATUS_MS : PENDING_STATUS_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [lastSent, delivered]);

  const handleSend = async () => {
    if (sending) {
      return;
    }

    playPressFeedback();
    setSending(true);
    setSendError(null);

    const trigger: Record<string, unknown> = {
      from: uid,
      fromName: selfName,
      pattern: selected.custom ? 'custom' : selected.id,
      createdAt: Date.now(),
    };
    if (selected.custom) {
      trigger.timings = selected.timings;
      trigger.amplitudes = selected.amplitudes ?? [];
      trigger.patternLabel = selected.label;
    }

    try {
      const triggerRef = push(
        ref(getDatabase(), `pairs/${pairId}/triggers`),
      );
      await set(triggerRef, trigger);
      setLastSent({
        label: selected.label,
        at: Date.now(),
        triggerId: triggerRef.key ?? '',
      });
    } catch (error) {
      if (isNetworkError(error)) {
        setSendError('No connection. The pulse did not leave this phone.');
      } else {
        setSendError(
          'The pulse could not be sent. Check your Firebase setup and try again.',
        );
      }
    } finally {
      setSending(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await onLeave();
    } catch (error) {
      setLeaving(false);
      Alert.alert(
        'Could not unlink this phone',
        error instanceof Error
          ? error.message
          : describePairError(error),
      );
    }
  };

  const confirmLeave = () => {
    Alert.alert(
      'Unlink this phone?',
      `You will stop sending and receiving pulses with ${partner.name}.`,
      [
        { text: 'Keep link', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: () => {
            handleLeave();
          },
        },
      ],
    );
  };

  let statusText = privacyState.paused
    ? 'Delivery paused on this phone'
    : 'Silent delivery · no notification on their phone';
  let statusColor: string = privacyState.paused
    ? colors.coral
    : colors.textFaint;
  if (sending) {
    statusText = 'Sending silently…';
    statusColor = colors.textMuted;
  } else if (sendError) {
    statusText = sendError;
    statusColor = colors.coral;
  } else if (lastSent) {
    statusText = delivered
      ? `${lastSent.label} pulse delivered`
      : `${lastSent.label} pulse sent`;
    statusColor = delivered ? colors.green : colors.accent;
  }

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
        <Text style={styles.eyebrow}>SEND A PULSE TO</Text>
        <Text style={styles.partnerName} numberOfLines={2}>
          {partner.name}
        </Text>
        <View style={styles.presenceRow}>
          <View
            style={[
              styles.presenceDot,
              partner.online ? styles.presenceOnline : styles.presenceIdle,
            ]}
          />
          <Text style={styles.presenceText}>
            {partner.online ? 'Active on the link' : 'Ready in the background'}
          </Text>
          <View style={styles.presenceDivider} />
          <Text style={styles.presenceMeta}>
            {privacyState.paused ? 'DELIVERY PAUSED' : 'ENCRYPTED IN TRANSIT'}
          </Text>
        </View>
      </View>

      <View style={styles.pulseStage}>
        <PulseButton
          disabled={sending}
          onPress={handleSend}
          partnerName={partner.name}
          patternLabel={selected.label}
        />
      </View>

      <View style={styles.statusLine}>
        <Text
          numberOfLines={2}
          style={[styles.statusText, { color: statusColor }]}
        >
          {statusText}
        </Text>
      </View>

      <View style={styles.patternSection}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>CHOOSE A FEEL</Text>
          <Text numberOfLines={1} style={styles.sectionHint}>
            {selected.description}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.patternRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {options.map(option => {
            const active = option.id === selected.id;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${option.label}: ${option.description}`}
                disabled={sending}
                key={option.id}
                onPress={() => {
                  playPressFeedback();
                  setSelectedId(option.id);
                  setSendError(null);
                }}
                style={({ pressed }) => [
                  styles.patternChip,
                  active ? styles.patternChipActive : null,
                  pressed ? styles.patternChipPressed : null,
                ]}
              >
                <PatternGlyph active={active} timings={option.timings} />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.patternChipLabel,
                    active ? styles.patternChipLabelActive : null,
                  ]}
                >
                  {option.label}
                </Text>
                {option.custom ? (
                  <Text style={styles.patternChipTag}>CUSTOM</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <View style={styles.infoBarShort} />
          <View style={styles.infoBarTall} />
          <View style={styles.infoBarMid} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>Quiet by design</Text>
          <Text style={styles.infoBody}>
            Their phone only vibrates. Nothing appears in the notification
            shade.
          </Text>
        </View>
      </View>

      <BackgroundAccessCard />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Unlink this phone"
        disabled={leaving}
        hitSlop={8}
        onPress={confirmLeave}
        style={({ pressed }) => [
          styles.unlinkButton,
          pressed ? styles.unlinkPressed : null,
        ]}
      >
        <Text style={styles.unlinkText}>
          {leaving ? 'Unlinking…' : 'Unlink this phone'}
        </Text>
      </Pressable>
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
      gap: 8,
    },
    eyebrow: {
      ...type.eyebrow,
      color: colors.accent,
    },
    partnerName: {
      ...type.display,
      fontSize: 40,
      lineHeight: 43,
      color: colors.text,
      maxWidth: '100%',
    },
    presenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 4,
    },
    presenceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    presenceOnline: {
      backgroundColor: colors.green,
    },
    presenceIdle: {
      backgroundColor: colors.accent,
    },
    presenceText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    presenceDivider: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.textFaint,
      marginHorizontal: 2,
    },
    presenceMeta: {
      ...type.eyebrow,
      fontSize: 8,
      letterSpacing: 1.2,
      color: colors.textFaint,
    },
    pulseStage: {
      marginTop: 12,
    },
    statusLine: {
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.medium,
    },
    statusText: {
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
    },
    patternSection: {
      gap: spacing.small,
      marginTop: 4,
    },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 12,
    },
    sectionLabel: {
      ...type.eyebrow,
      color: colors.textFaint,
    },
    sectionHint: {
      flexShrink: 1,
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'right',
    },
    patternRow: {
      flexDirection: 'row',
      gap: 8,
      paddingRight: 4,
      paddingVertical: 2,
    },
    patternChip: {
      minWidth: 84,
      minHeight: 82,
      paddingHorizontal: 10,
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    patternChipActive: {
      borderColor: colors.accentLine,
      backgroundColor: colors.accentWash,
    },
    patternChipPressed: {
      opacity: 0.75,
    },
    patternChipLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      maxWidth: 84,
    },
    patternChipLabelActive: {
      color: colors.accent,
    },
    patternChipTag: {
      ...type.eyebrow,
      fontSize: 7,
      letterSpacing: 1,
      color: colors.textFaint,
    },
    glyph: {
      height: 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    glyphBar: {
      width: 3,
      borderRadius: 2,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      marginTop: spacing.medium,
      padding: 14,
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    infoIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surfaceRaised,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2.5,
    },
    infoBarShort: {
      width: 2.5,
      height: 7,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    infoBarTall: {
      width: 2.5,
      height: 15,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    infoBarMid: {
      width: 2.5,
      height: 11,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    infoCopy: {
      flex: 1,
      gap: 3,
    },
    infoTitle: {
      ...type.label,
      color: colors.text,
    },
    infoBody: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    unlinkButton: {
      minHeight: 46,
      marginTop: spacing.small,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unlinkPressed: {
      opacity: 0.6,
    },
    unlinkText: {
      ...type.label,
      color: colors.textFaint,
    },
  });
