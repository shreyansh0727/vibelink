import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

function MiniPhone({ tilt }: { tilt: string }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={[styles.phone, { transform: [{ rotate: tilt }] }]}>
      <View style={styles.speaker} />
      <View style={styles.screenLine} />
      <View style={styles.screenShortLine} />
      <View style={styles.phoneDot} />
    </View>
  );
}

export function LinkGraphic() {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <View style={styles.halo} />
      <View style={styles.dashedLine} />
      <View style={styles.phones}>
        <View style={styles.device}>
          <MiniPhone tilt="-7deg" />
          <Text style={styles.deviceLabel}>THIS PHONE</Text>
        </View>

        <View style={styles.signal}>
          <View style={[styles.signalBar, styles.signalSmall]} />
          <View style={[styles.signalBar, styles.signalTall]} />
          <View style={[styles.signalBar, styles.signalMid]} />
        </View>

        <View style={styles.device}>
          <MiniPhone tilt="7deg" />
          <Text style={styles.deviceLabel}>THEIRS</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = ({ colors, radii, type }: AppTheme) =>
  StyleSheet.create({
    card: {
      height: 154,
      borderRadius: radii.large,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginTop: 30,
    },
    halo: {
      position: 'absolute',
      width: 190,
      height: 190,
      borderRadius: 95,
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    dashedLine: {
      position: 'absolute',
      left: 84,
      right: 84,
      top: 69,
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.accentLine,
    },
    phones: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 30,
    },
    device: {
      alignItems: 'center',
      gap: 8,
    },
    phone: {
      width: 42,
      height: 67,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 7,
      paddingTop: 7,
    },
    speaker: {
      width: 12,
      height: 2.5,
      borderRadius: 2,
      backgroundColor: colors.textFaint,
      alignSelf: 'center',
      marginBottom: 8,
    },
    screenLine: {
      width: 20,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.accentLine,
      marginBottom: 4,
    },
    screenShortLine: {
      width: 13,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.lineStrong,
    },
    phoneDot: {
      position: 'absolute',
      bottom: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
      alignSelf: 'center',
    },
    deviceLabel: {
      ...type.eyebrow,
      color: colors.textFaint,
      fontSize: 8,
      letterSpacing: 1.4,
    },
    signal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 38,
    },
    signalBar: {
      width: 4,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    signalSmall: {
      height: 9,
    },
    signalTall: {
      height: 33,
    },
    signalMid: {
      height: 20,
    },
  });
