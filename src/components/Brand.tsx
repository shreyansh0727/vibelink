import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

export function BrandMark() {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.mark}>
      <View style={[styles.markBar, styles.markBarShort]} />
      <View style={[styles.markBar, styles.markBarTall]} />
      <View style={[styles.markBar, styles.markBarMid]} />
    </View>
  );
}

export function Wordmark() {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.wordmark}>
      <BrandMark />
      <Text style={styles.wordmarkText}>VIBELINK</Text>
    </View>
  );
}

export function Header({ right }: { right?: React.ReactNode }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Wordmark />
      {right}
    </View>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 32,
    },
    wordmark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    wordmarkText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 2.5,
    },
    mark: {
      width: 24,
      height: 24,
      borderRadius: 8,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2.5,
    },
    markBar: {
      width: 2.5,
      borderRadius: 2,
      backgroundColor: colors.accentInk,
    },
    markBarShort: {
      height: 6,
    },
    markBarTall: {
      height: 13,
    },
    markBarMid: {
      height: 9,
    },
  });
