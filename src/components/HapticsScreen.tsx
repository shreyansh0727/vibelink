import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Header } from './Brand';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { Screen } from './Screen';
import { Text } from '../ui/Text';
import { RoundButton } from '../ui/RoundButton';
import { useCustomPatterns } from '../hooks/useCustomPatterns';
import { playPressFeedback, playTimings } from '../lib/haptics';
import {
  BUILT_IN_KEYS,
  BUILT_IN_PATTERNS,
  buildCustomTimings,
  scaledAmplitudes,
} from '../lib/patterns';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

const STRENGTHS = [
  { id: 'soft', label: 'Soft', factor: 0.4 },
  { id: 'medium', label: 'Medium', factor: 0.7 },
  { id: 'strong', label: 'Strong', factor: 1 },
] as const;

type StrengthId = (typeof STRENGTHS)[number]['id'];

function glyphBars(timings: number[]): number[] {
  const bars: number[] = [];
  for (let index = 1; index < timings.length && bars.length < 7; index += 2) {
    const duration = timings[index] ?? 0;
    bars.push(Math.max(6, Math.min(20, 6 + duration / 45)));
  }
  return bars.length ? bars : [10];
}

function WaveGlyph({ timings }: { timings: number[] }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.glyph}>
      {glyphBars(timings).map((height, index) => (
        <View key={index} style={[styles.glyphBar, { height }]} />
      ))}
    </View>
  );
}

function PatternRow({
  label,
  description,
  timings,
  amplitudes,
  onRemove,
}: {
  label: string;
  description: string;
  timings: number[];
  amplitudes?: number[];
  onRemove?: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <WaveGlyph timings={timings} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription} numberOfLines={2}>
          {description}
        </Text>
      </View>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          hitSlop={6}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeButton,
            pressed ? styles.ghostPressed : null,
          ]}
        >
          <Text style={styles.removeText}>REMOVE</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Preview ${label}`}
        onPress={() => {
          playPressFeedback();
          playTimings(timings, amplitudes);
        }}
        style={({ pressed }) => [
          styles.playButton,
          pressed ? styles.playPressed : null,
        ]}
      >
        <Text style={styles.playText}>PLAY</Text>
      </Pressable>
    </View>
  );
}

function Stepper({
  label,
  value,
  suffix,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperCopy}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <Text style={styles.stepperValue}>
          {value}
          {suffix}
        </Text>
      </View>
      <View style={styles.stepperControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          disabled={value <= min}
          onPress={() => {
            playPressFeedback();
            onChange(Math.max(min, value - step));
          }}
          style={({ pressed }) => [
            styles.stepButton,
            pressed ? styles.ghostPressed : null,
            value <= min ? styles.stepDisabled : null,
          ]}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          disabled={value >= max}
          onPress={() => {
            playPressFeedback();
            onChange(Math.min(max, value + step));
          }}
          style={({ pressed }) => [
            styles.stepButton,
            pressed ? styles.ghostPressed : null,
            value >= max ? styles.stepDisabled : null,
          ]}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ChoiceChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : null,
        pressed ? styles.ghostPressed : null,
      ]}
    >
      <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function HapticsScreen({ onBack }: { onBack: () => void }) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const { patterns, addPattern, removePattern } = useCustomPatterns();
  const [name, setName] = useState('');
  const [pulses, setPulses] = useState(3);
  const [pulseMs, setPulseMs] = useState(180);
  const [gapMs, setGapMs] = useState(120);
  const [strength, setStrength] = useState<StrengthId>('medium');
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  const strengthFactor = useMemo(
    () => STRENGTHS.find(option => option.id === strength)?.factor ?? 0.7,
    [strength],
  );

  const draft = useMemo(
    () => buildCustomTimings(pulses, pulseMs, gapMs),
    [pulses, pulseMs, gapMs],
  );
  const draftAmplitudes = useMemo(
    () => scaledAmplitudes(draft.amplitudes, strengthFactor),
    [draft, strengthFactor],
  );

  const preview = () => {
    playPressFeedback();
    playTimings(draft.timings, draftAmplitudes);
  };

  const save = () => {
    const created = addPattern(name, draft.timings, draftAmplitudes);
    setSavedLabel(created.label);
    setName('');
    playTimings(created.timings, created.amplitudes);
    setTimeout(() => setSavedLabel(current => (current === created.label ? null : current)), 4000);
  };

  return (
    <Screen>
      <Header
        right={
          <RoundButton
            accessibilityLabel="Back"
            kind="back"
            onPress={onBack}
          />
        }
      />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>HAPTIC LAB</Text>
        <Text style={styles.title}>Feel it before{'\n'}you send it.</Text>
        <Text style={styles.body}>
          Preview every built-in pulse without pairing. Build your own rhythm
          and it becomes available on the controller.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>BUILT-IN FEELS</Text>
        <View style={styles.card}>
          {BUILT_IN_KEYS.map((key, index) => {
            const pattern = BUILT_IN_PATTERNS[key];
            return (
              <View
                key={key}
                style={index > 0 ? styles.rowDivider : undefined}
              >
                <PatternRow
                  amplitudes={pattern.amplitudes}
                  description={pattern.description}
                  label={pattern.label}
                  timings={pattern.timings}
                />
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>YOUR FEELS</Text>
        {patterns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nothing saved yet. Build a rhythm below and it will show up here.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {patterns.map((pattern, index) => (
              <View
                key={pattern.id}
                style={index > 0 ? styles.rowDivider : undefined}
              >
                <PatternRow
                  amplitudes={pattern.amplitudes}
                  description="Saved custom feel"
                  label={pattern.label}
                  onRemove={() => removePattern(pattern.id)}
                  timings={pattern.timings}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>BUILD A CUSTOM FEEL</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              accessibilityLabel="Custom pattern name"
              autoCorrect={false}
              cursorColor={colors.accent}
              keyboardAppearance="dark"
              maxLength={24}
              onChangeText={setName}
              placeholder="My pulse"
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.accentLine}
              style={styles.input}
              value={name}
            />
          </View>

          <Stepper
            label="Pulses"
            max={8}
            min={1}
            onChange={setPulses}
            step={1}
            suffix="×"
            value={pulses}
          />
          <Stepper
            label="Pulse length"
            max={600}
            min={40}
            onChange={setPulseMs}
            step={20}
            suffix=" ms"
            value={pulseMs}
          />
          <Stepper
            label="Space between"
            max={800}
            min={30}
            onChange={setGapMs}
            step={10}
            suffix=" ms"
            value={gapMs}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>STRENGTH</Text>
            <View style={styles.chipRow}>
              {STRENGTHS.map(option => (
                <ChoiceChip
                  active={strength === option.id}
                  key={option.id}
                  label={option.label}
                  onPress={() => {
                    playPressFeedback();
                    setStrength(option.id);
                  }}
                />
              ))}
            </View>
          </View>

          <View style={styles.previewRow}>
            <SecondaryButton
              label="Preview"
              onPress={preview}
              style={styles.previewButton}
            />
            <PrimaryButton
              label="Save pattern"
              onPress={save}
              style={styles.previewButton}
            />
          </View>

          {savedLabel ? (
            <Text style={styles.savedText}>
              Saved “{savedLabel}”. Choose it on the controller.
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = ({ colors, radii, spacing, type, fontScale }: AppTheme) =>
  StyleSheet.create({
    hero: {
      marginTop: 34,
      gap: spacing.medium,
    },
    eyebrow: {
      ...type.eyebrow,
      color: colors.accent,
    },
    title: {
      ...type.display,
      fontSize: 38,
      lineHeight: 41,
      color: colors.text,
    },
    body: {
      ...type.body,
      color: colors.textMuted,
      maxWidth: 420,
    },
    section: {
      marginTop: spacing.large,
      gap: spacing.small,
    },
    sectionLabel: {
      ...type.eyebrow,
      color: colors.textFaint,
    },
    card: {
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      ...type.label,
      color: colors.text,
    },
    rowDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    glyph: {
      width: 34,
      height: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    glyphBar: {
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    playButton: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.accentLine,
      backgroundColor: colors.accentWash,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playPressed: {
      backgroundColor: colors.accentLine,
    },
    playText: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.accent,
    },
    removeButton: {
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    removeText: {
      ...type.eyebrow,
      fontSize: 8,
      letterSpacing: 1,
      color: colors.textFaint,
    },
    ghostPressed: {
      opacity: 0.6,
    },
    emptyCard: {
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.line,
      borderStyle: 'dashed',
      backgroundColor: colors.surface,
      padding: 16,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    field: {
      gap: 8,
      paddingTop: 14,
    },
    fieldLabel: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.textFaint,
    },
    input: {
      height: 46,
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surfaceRaised,
      color: colors.text,
      paddingHorizontal: 12,
      fontSize: 15 * fontScale,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 14,
    },
    stepperCopy: {
      gap: 2,
    },
    stepperLabel: {
      ...type.label,
      color: colors.text,
    },
    stepperValue: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: 'monospace',
    },
    stepperControls: {
      flexDirection: 'row',
      gap: 8,
    },
    stepButton: {
      width: 38,
      height: 38,
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDisabled: {
      opacity: 0.35,
    },
    stepText: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 21,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      flex: 1,
      minHeight: 40,
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: {
      borderColor: colors.accentLine,
      backgroundColor: colors.accentWash,
    },
    chipLabel: {
      ...type.label,
      fontSize: 12,
      color: colors.textMuted,
    },
    chipLabelActive: {
      color: colors.accent,
    },
    previewRow: {
      flexDirection: 'row',
      gap: spacing.small,
      paddingTop: spacing.medium,
      paddingBottom: 16,
    },
    previewButton: {
      flex: 1,
      minHeight: 48,
    },
    savedText: {
      color: colors.green,
      fontSize: 12,
      lineHeight: 17,
      paddingBottom: 14,
      marginTop: -6,
    },
  });
