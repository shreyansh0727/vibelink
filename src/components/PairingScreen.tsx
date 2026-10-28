import React, { useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Header } from './Brand';
import { BackgroundAccessCard } from './BackgroundAccessCard';
import { PrimaryButton, SecondaryButton, TextButton } from './Buttons';
import { LinkGraphic } from './LinkGraphic';
import { RoundButton } from '../ui/RoundButton';
import { Screen } from './Screen';
import { Text } from '../ui/Text';
import {
  cleanPairCodeInput,
  isValidPairCode,
  PAIR_CODE_LENGTH,
} from '../lib/pairingCode';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

type PairingScreenProps = {
  deviceName: string;
  onCreatePair: () => Promise<void>;
  onJoinPair: (code: string) => Promise<void>;
  onOpenSettings: () => void;
  onOpenHaptics: () => void;
};

type Mode = 'intro' | 'join';

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export function PairingScreen({
  deviceName,
  onCreatePair,
  onJoinPair,
  onOpenSettings,
  onOpenHaptics,
}: PairingScreenProps) {
  const { styles, colors, theme } = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<Mode>('intro');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  const normalizedCode = cleanPairCodeInput(code);
  const codeIsReady =
    normalizedCode.length === PAIR_CODE_LENGTH &&
    isValidPairCode(normalizedCode);

  const handleCreate = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreatePair();
    } catch (createError) {
      setError(errorText(createError));
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (busy || !codeIsReady) {
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      await onJoinPair(normalizedCode);
    } catch (joinError) {
      setError(errorText(joinError));
      setBusy(false);
    }
  };

  const openJoin = () => {
    setError(null);
    setCode('');
    setMode('join');
  };

  const closeJoin = () => {
    setError(null);
    setCode('');
    setMode('intro');
  };

  if (mode === 'join') {
    return (
      <Screen>
        <Header
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              onPress={closeJoin}
              style={({ pressed }) => [
                styles.backButton,
                pressed ? styles.backButtonPressed : null,
              ]}
            >
              <Text style={styles.backIcon}>←</Text>
            </Pressable>
          }
        />

        <View style={styles.joinHero}>
          <Text style={styles.eyebrow}>JOIN A PAIR</Text>
          <Text style={styles.joinTitle}>
            Enter the{'\n'}pairing code.
          </Text>
          <Text style={styles.body}>
            Find the eight-character code on the other phone. The code only
            works while that screen is waiting.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.inputLabel}>CODE FROM THE OTHER PHONE</Text>
          <View
            style={[
              styles.inputShell,
              inputFocused ? styles.inputShellFocused : null,
            ]}
          >
            <TextInput
              accessibilityLabel="Pairing code"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect={false}
              autoFocus
              cursorColor={colors.accent}
              keyboardAppearance="dark"
              maxLength={PAIR_CODE_LENGTH}
              onBlur={() => setInputFocused(false)}
              onChangeText={value => {
                setCode(cleanPairCodeInput(value));
                setError(null);
              }}
              onFocus={() => setInputFocused(true)}
              onSubmitEditing={handleJoin}
              placeholder="ABCDEFGH"
              placeholderTextColor={colors.textFaint}
              returnKeyType="go"
              selectionColor={colors.accentLine}
              spellCheck={false}
              style={[
                styles.input,
                { fontSize: 27 * theme.fontScale },
              ]}
              value={normalizedCode}
            />
          </View>
          <View style={styles.inputMeta}>
            <Text style={styles.inputHint}>
              Letters and numbers only. No 0, 1, I, or O.
            </Text>
            <Text style={styles.inputCount}>
              {normalizedCode.length}/{PAIR_CODE_LENGTH}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            disabled={!codeIsReady}
            label="Join pair"
            loading={busy}
            onPress={handleJoin}
            style={styles.joinButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.deviceLine}>THIS PHONE · {deviceName}</Text>
        </View>
      </Screen>
    );
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
        <Text style={styles.eyebrow}>PRIVATE REMOTE HAPTICS</Text>
        <Text style={styles.display}>A quiet tap,{'\n'}from anywhere.</Text>
        <Text style={styles.body}>
          Pair two Android phones, then send a pulse the other phone can feel.
          No notification. No banner. Just a tap on the shoulder.
        </Text>
      </View>

      <LinkGraphic />

      {error ? (
        <View style={[styles.errorBox, styles.introError]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <PrimaryButton
          label={busy ? 'Creating your pair…' : 'Create a pair'}
          loading={busy}
          onPress={handleCreate}
        />
        <SecondaryButton
          disabled={busy}
          label="I have a code"
          onPress={openJoin}
        />
        <TextButton
          disabled={busy}
          label="Preview haptics without pairing"
          onPress={onOpenHaptics}
        />
      </View>

      <BackgroundAccessCard />

      <View style={styles.footer}>
        <Text style={styles.footnote}>
          TWO PHONES · ONE PAIR · ZERO BANNERS
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
      marginTop: 42,
      gap: spacing.medium,
    },
    eyebrow: {
      ...type.eyebrow,
      color: colors.accent,
    },
    display: {
      ...type.display,
      color: colors.text,
    },
    joinHero: {
      marginTop: 54,
      gap: spacing.medium,
    },
    joinTitle: {
      ...type.display,
      color: colors.text,
    },
    body: {
      ...type.body,
      color: colors.textMuted,
      maxWidth: 400,
    },
    spacer: {
      flexGrow: 1,
      minHeight: 34,
    },
    actions: {
      gap: spacing.small,
    },
    introError: {
      marginTop: spacing.medium,
    },
    form: {
      marginTop: 38,
    },
    inputLabel: {
      ...type.eyebrow,
      color: colors.textFaint,
      marginBottom: spacing.small,
    },
    inputShell: {
      height: 74,
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.medium,
    },
    inputShellFocused: {
      borderColor: colors.accentLine,
      backgroundColor: colors.surfaceRaised,
    },
    input: {
      ...type.mono,
      width: '100%',
      color: colors.text,
      letterSpacing: 4,
      textAlign: 'center',
      paddingVertical: 0,
    },
    inputMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.small,
      marginTop: spacing.small,
      marginBottom: spacing.large,
    },
    inputHint: {
      flex: 1,
      color: colors.textFaint,
      fontSize: 12,
      lineHeight: 17,
    },
    inputCount: {
      color: colors.textFaint,
      fontSize: 12,
      fontFamily: 'monospace',
      paddingTop: 1,
    },
    joinButton: {
      marginTop: spacing.small,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    backButtonPressed: {
      backgroundColor: colors.surfaceRaised,
    },
    backIcon: {
      color: colors.text,
      fontSize: 20,
      lineHeight: 23,
    },
    errorBox: {
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.coral,
      backgroundColor: colors.accentWash,
      padding: 14,
      marginBottom: spacing.medium,
    },
    errorText: {
      color: colors.coral,
      fontSize: 13,
      lineHeight: 19,
    },
    footer: {
      paddingTop: spacing.large,
      gap: spacing.small,
      alignItems: 'center',
    },
    footnote: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.6,
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
