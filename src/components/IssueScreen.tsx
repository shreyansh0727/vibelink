import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Header } from './Brand';
import { PrimaryButton } from './Buttons';
import { Screen } from './Screen';
import { Text } from '../ui/Text';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

type IssueScreenProps = {
  title: string;
  message: string;
  hint?: string;
  onRetry: () => void;
};

export function IssueScreen({
  title,
  message,
  hint,
  onRetry,
}: IssueScreenProps) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Screen>
      <Header />

      <View style={styles.spacerTop} />

      <View style={styles.icon}>
        <Text style={styles.iconText}>!</Text>
      </View>

      <Text style={styles.eyebrow}>NEEDS ATTENTION</Text>
      <Text style={styles.title}>{title}</Text>
      <Text selectable style={styles.message}>
        {message}
      </Text>

      {hint ? (
        <View style={styles.hintCard}>
          <Text style={styles.hintLabel}>SETUP CHECK</Text>
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ) : null}

      <View style={styles.spacerBottom} />

      <PrimaryButton label="Try again" onPress={onRetry} />

      <Text style={styles.footer}>
        VibeLink shows no notifications on either phone.
      </Text>
    </Screen>
  );
}

const makeStyles = ({ colors, radii, spacing, type }: AppTheme) =>
  StyleSheet.create({
    spacerTop: {
      flexGrow: 0.7,
      minHeight: 32,
    },
    spacerBottom: {
      flexGrow: 1,
      minHeight: 28,
    },
    icon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255, 138, 107, 0.4)',
      backgroundColor: 'rgba(255, 138, 107, 0.09)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 26,
    },
    iconText: {
      color: colors.coral,
      fontSize: 28,
      fontWeight: '300',
    },
    eyebrow: {
      ...type.eyebrow,
      color: colors.coral,
      marginBottom: 12,
    },
    title: {
      ...type.title,
      color: colors.text,
      marginBottom: 14,
    },
    message: {
      ...type.body,
      color: colors.textMuted,
      maxWidth: 440,
    },
    hintCard: {
      marginTop: spacing.large,
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      padding: spacing.medium,
      gap: 7,
    },
    hintLabel: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.textFaint,
    },
    hintText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    footer: {
      marginTop: spacing.medium,
      color: colors.textFaint,
      fontSize: 11,
      textAlign: 'center',
    },
  });
