import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton, TextButton } from './Buttons';
import { Text } from '../ui/Text';
import { MAX_MEANING_LENGTH } from '../lib/language';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

type MeaningEditorProps = {
  visible: boolean;
  patternLabel: string;
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void;
};

export function MeaningEditor({
  visible,
  patternLabel,
  initialValue,
  onCancel,
  onSave,
}: MeaningEditorProps) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityLabel="Close the meaning editor"
          accessibilityRole="button"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>WHAT THIS FEEL MEANS</Text>
          <Text style={styles.title}>{patternLabel}</Text>
          <TextInput
            accessibilityLabel="Meaning for this feel"
            autoCorrect={false}
            autoFocus
            cursorColor={colors.accent}
            keyboardAppearance="dark"
            maxLength={MAX_MEANING_LENGTH}
            onChangeText={setValue}
            placeholder="Yes, come here, goodnight…"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.accentLine}
            style={styles.input}
            value={value}
          />
          <Text style={styles.hint}>
            Every linked phone sees this meaning. Leave it empty to use the
            default.
          </Text>
          <PrimaryButton
            label="Save meaning"
            onPress={() => onSave(value)}
          />
          <TextButton label="Cancel" onPress={onCancel} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = ({ colors, radii, spacing, type }: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.large,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    sheet: {
      width: '100%',
      maxWidth: 460,
      gap: spacing.small,
      padding: spacing.large,
      borderRadius: radii.large,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surfaceRaised,
    },
    eyebrow: {
      ...type.eyebrow,
      color: colors.accent,
    },
    title: {
      ...type.display,
      fontSize: 26,
      lineHeight: 30,
      color: colors.text,
    },
    input: {
      minHeight: 48,
      marginTop: spacing.small,
      paddingHorizontal: 14,
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 15,
    },
    hint: {
      marginBottom: spacing.small,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
  });
