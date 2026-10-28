import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: ScreenProps) {
  const { styles } = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const frameStyle = {
    paddingTop: insets.top + 14,
    paddingBottom: Math.max(insets.bottom, 18) + 14,
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.topHalo} />
        <View style={styles.topRing} />
        <View style={styles.bottomHalo} />
      </View>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, frameStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.column, contentStyle]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.fixedFrame, frameStyle]}>
          <View style={[styles.column, styles.fixedColumn, contentStyle]}>
            {children}
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 22,
      alignItems: 'center',
    },
    fixedFrame: {
      flex: 1,
      paddingHorizontal: 22,
      alignItems: 'center',
    },
    column: {
      width: '100%',
      maxWidth: 520,
      flexGrow: 1,
    },
    fixedColumn: {
      flex: 1,
    },
    topHalo: {
      position: 'absolute',
      width: 360,
      height: 360,
      borderRadius: 180,
      top: -210,
      right: -130,
      backgroundColor: colors.accentWash,
    },
    topRing: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      top: -156,
      right: -80,
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    bottomHalo: {
      position: 'absolute',
      width: 300,
      height: 300,
      borderRadius: 150,
      bottom: -230,
      left: -130,
      backgroundColor: colors.accentWash,
      opacity: 0.45,
    },
  });
