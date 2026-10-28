import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { formatPairCode, normalizePairCode } from '../lib/pairingCode';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

export function CodeDisplay({ code }: { code: string }) {
  const { styles } = useThemedStyles(makeStyles);
  const characters = normalizePairCode(code).split('');

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>PAIRING CODE</Text>
      <View style={styles.row}>
        {characters.map((character, index) => (
          <View
            key={`${character}-${index}`}
            style={[styles.tile, index === 4 ? styles.groupGap : null]}
          >
            <Text style={styles.character}>{character}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.spoken}>{formatPairCode(code)}</Text>
    </View>
  );
}

const makeStyles = ({ colors, radii, type }: AppTheme) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.large,
      padding: 18,
      gap: 12,
    },
    label: {
      ...type.eyebrow,
      color: colors.textFaint,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      gap: 5,
      justifyContent: 'center',
    },
    tile: {
      flex: 1,
      maxWidth: 48,
      height: 56,
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupGap: {
      marginLeft: 7,
    },
    character: {
      ...type.mono,
      color: colors.accent,
      fontSize: 23,
      letterSpacing: 0.5,
    },
    spoken: {
      color: colors.textMuted,
      textAlign: 'center',
      fontSize: 13,
      letterSpacing: 3,
    },
  });
