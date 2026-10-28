import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Header } from './Brand';
import { PrimaryButton, SecondaryButton, TextButton } from './Buttons';
import { Screen } from './Screen';
import { Text } from '../ui/Text';
import { RoundButton } from '../ui/RoundButton';
import { useCustomPatterns } from '../hooks/useCustomPatterns';
import { playPressFeedback, playTimings } from '../lib/haptics';
import {
  BUILT_IN_KEYS,
  BUILT_IN_PATTERNS,
  MAX_RHYTHM_GAP_MS,
  MAX_RHYTHM_PULSE_MS,
  MAX_RHYTHM_REPEAT,
  MAX_RHYTHM_STEPS,
  MIN_RHYTHM_GAP_MS,
  MIN_RHYTHM_PULSE_MS,
  buildRhythm,
  type RhythmStep,
} from '../lib/patterns';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

const STARTING_STEPS: RhythmStep[] = [
  { lengthMs: 180, gapMs: 120, strength: 178 },
  { lengthMs: 180, gapMs: 120, strength: 178 },
  { lengthMs: 180, gapMs: 120, strength: 178 },
];

function glyphBars(
  timings: number[],
  amplitudes?: number[],
): Array<{ height: number; strength: number }> {
  const bars: Array<{ height: number; strength: number }> = [];
  for (let index = 1; index < timings.length && bars.length < 7; index += 2) {
    const duration = timings[index] ?? 0;
    const amplitude = amplitudes?.[index] ?? 200;
    bars.push({
      height: Math.max(6, Math.min(20, 6 + duration / 45)),
      strength: Math.max(0.35, Math.min(1, amplitude / 255)),
    });
  }
  return bars.length ? bars : [{ height: 10, strength: 1 }];
}

function WaveGlyph({
  timings,
  amplitudes,
}: {
  timings: number[];
  amplitudes?: number[];
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.glyph}>
      {glyphBars(timings, amplitudes).map((bar, index) => (
        <View
          key={index}
          style={[
            styles.glyphBar,
            { height: bar.height, opacity: bar.strength },
          ]}
        />
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
      <WaveGlyph amplitudes={amplitudes} timings={timings} />
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

export function HapticsScreen({ onBack }: { onBack: () => void }) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const { patterns, addPattern, removePattern } = useCustomPatterns();
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<RhythmStep[]>(STARTING_STEPS);
  const [repeat, setRepeat] = useState(1);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  const draft = useMemo(() => buildRhythm(steps, repeat), [steps, repeat]);
  const totalMs = useMemo(
    () => (draft ? draft.timings.reduce((sum, ms) => sum + ms, 0) : 0),
    [draft],
  );
  const pulseCount = steps.length * repeat;

  const updateStep = (index: number, patch: Partial<RhythmStep>) => {
    setSteps(current =>
      current.map((step, position) =>
        position === index ? { ...step, ...patch } : step,
      ),
    );
  };

  const addStep = () => {
    playPressFeedback();
    setSteps(current =>
      current.length >= MAX_RHYTHM_STEPS
        ? current
        : [...current, current[current.length - 1]],
    );
  };

  const removeStep = (index: number) => {
    playPressFeedback();
    setSteps(current =>
      current.length <= 1
        ? current
        : current.filter((_, position) => position !== index),
    );
  };

  const preview = () => {
    if (!draft) {
      return;
    }
    playPressFeedback();
    playTimings(draft.timings, draft.amplitudes);
  };

  const save = () => {
    if (!draft) {
      return;
    }
    const created = addPattern(name, draft.timings, draft.amplitudes);
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
          Preview every built-in pulse without pairing. Shape each pulse in a
          rhythm and it becomes available on the controller.
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
        <Text style={styles.sectionLabel}>BUILD A CUSTOM RHYTHM</Text>
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

          <View style={styles.stepList}>
            <View style={styles.stepListHeader}>
              <Text style={styles.fieldLabel}>PULSE SHAPE</Text>
              <TextButton
                disabled={steps.length >= MAX_RHYTHM_STEPS}
                label="+ Add pulse"
                onPress={addStep}
              />
            </View>

            {steps.map((step, index) => (
              <View key={index} style={styles.stepCard}>
                <View style={styles.stepCardHeader}>
                  <Text style={styles.stepCardTitle}>PULSE {index + 1}</Text>
                  {steps.length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove pulse ${index + 1}`}
                      hitSlop={8}
                      onPress={() => removeStep(index)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed ? styles.ghostPressed : null,
                      ]}
                    >
                      <Text style={styles.removeText}>REMOVE</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Stepper
                  label="Length"
                  max={MAX_RHYTHM_PULSE_MS}
                  min={MIN_RHYTHM_PULSE_MS}
                  onChange={value => updateStep(index, { lengthMs: value })}
                  step={20}
                  suffix=" ms"
                  value={step.lengthMs}
                />
                <Stepper
                  label="Gap after"
                  max={MAX_RHYTHM_GAP_MS}
                  min={MIN_RHYTHM_GAP_MS}
                  onChange={value => updateStep(index, { gapMs: value })}
                  step={10}
                  suffix=" ms"
                  value={step.gapMs}
                />
                <Stepper
                  label="Strength"
                  max={100}
                  min={0}
                  onChange={value =>
                    updateStep(index, { strength: Math.round(value * 2.55) })
                  }
                  step={10}
                  suffix="%"
                  value={Math.round((step.strength / 255) * 100)}
                />
              </View>
            ))}
          </View>

          <Stepper
            label="Repeat rhythm"
            max={MAX_RHYTHM_REPEAT}
            min={1}
            onChange={setRepeat}
            step={1}
            suffix="×"
            value={repeat}
          />

          {draft ? (
            <Text style={styles.rhythmSummary}>
              {pulseCount} {pulseCount === 1 ? 'pulse' : 'pulses'} ·{' '}
              {(totalMs / 1000).toFixed(1)} s
            </Text>
          ) : (
            <Text style={styles.rhythmWarning}>
              That is too many pulses for one feel. Remove a pulse or lower the
              repeat.
            </Text>
          )}

          <View style={styles.previewRow}>
            <SecondaryButton
              disabled={!draft}
              label="Preview"
              onPress={preview}
              style={styles.previewButton}
            />
            <PrimaryButton
              disabled={!draft}
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
    stepList: {
      marginTop: 14,
      gap: 10,
    },
    stepListHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepCard: {
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 12,
      paddingBottom: 14,
    },
    stepCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
    },
    stepCardTitle: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.accent,
    },
    rhythmSummary: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: 'monospace',
      paddingTop: 14,
    },
    rhythmWarning: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      paddingTop: 14,
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
