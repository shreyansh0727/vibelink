import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ControllerScreen } from './src/components/ControllerScreen';
import { HapticsScreen } from './src/components/HapticsScreen';
import { IncomingBanner } from './src/components/IncomingBanner';
import { IssueScreen } from './src/components/IssueScreen';
import { PairingScreen } from './src/components/PairingScreen';
import { SettingsScreen } from './src/components/SettingsScreen';
import { SplashScreen } from './src/components/SplashScreen';
import { UpdateBanner } from './src/components/UpdateBanner';
import { WaitingScreen } from './src/components/WaitingScreen';
import { useAnonymousAuth } from './src/hooks/useAnonymousAuth';
import { useAppUpdate } from './src/hooks/useAppUpdate';
import { useIncomingPulse } from './src/hooks/useIncomingPulse';
import { useNotificationChannel } from './src/hooks/useNotificationChannel';
import { usePairing } from './src/hooks/usePairing';
import { DEVICE_NAME } from './src/lib/deviceName';
import {
  ThemeProvider,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from './src/theme/ThemeProvider';

type Route = 'main' | 'settings' | 'haptics';
type HapticsOrigin = 'main' | 'settings';

function Root() {
  const { styles } = useThemedStyles(makeStyles);
  const { ready: themeReady } = useTheme();
  const auth = useAnonymousAuth();
  const channel = useNotificationChannel(auth.uid);
  const pairing = usePairing(auth.uid, DEVICE_NAME);
  const incomingPulse = useIncomingPulse();
  const appUpdate = useAppUpdate(auth.uid);
  const [route, setRoute] = useState<Route>('main');
  const [hapticsOrigin, setHapticsOrigin] = useState<HapticsOrigin>('main');

  const openHaptics = useCallback((origin: HapticsOrigin) => {
    setHapticsOrigin(origin);
    setRoute('haptics');
  }, []);

  const goBack = useCallback(() => {
    setRoute(current =>
      current === 'haptics' ? hapticsOrigin : 'main',
    );
  }, [hapticsOrigin]);

  useEffect(() => {
    if (route === 'main') {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        goBack();
        return true;
      },
    );
    return () => {
      subscription.remove();
    };
  }, [route, goBack]);

  let content: React.ReactNode;
  let issue: {
    title: string;
    message: string;
    hint: string;
    onRetry: () => void;
  } | null = null;

  if (auth.error) {
    issue = {
      title: 'Firebase could not sign in.',
      message: auth.error,
      hint: 'Enable Anonymous sign-in in Firebase Authentication, confirm google-services.json is in android/app, and rebuild the app.',
      onRetry: auth.retry,
    };
  } else if (auth.uid && !channel.loading && channel.error) {
    issue = {
      title: 'Silent delivery is blocked.',
      message: channel.error,
      hint: 'Deploy database.rules.json and make sure Cloud Messaging is available in this Firebase project.',
      onRetry: channel.retry,
    };
  } else if (
    auth.uid &&
    channel.ready &&
    pairing.status === 'error' &&
    pairing.error
  ) {
    issue = {
      title: 'The link went quiet.',
      message: pairing.error,
      hint: 'Both phones need internet access. If this is a new setup, deploy the database rules and the relay Cloud Function.',
      onRetry: pairing.retry,
    };
  }

  if (!themeReady) {
    content = <SplashScreen label="Opening VibeLink" />;
  } else if (route === 'settings') {
    content = (
      <SettingsScreen
        onBack={() => setRoute('main')}
        onOpenHaptics={() => openHaptics('settings')}
        update={appUpdate}
      />
    );
  } else if (route === 'haptics') {
    content = (
      <HapticsScreen
        onBack={() => setRoute(hapticsOrigin)}
      />
    );
  } else if (issue) {
    content = (
      <IssueScreen
        hint={issue.hint}
        message={issue.message}
        onRetry={issue.onRetry}
        title={issue.title}
      />
    );
  } else if (auth.loading || !auth.uid) {
    content = <SplashScreen label="Opening a private session" />;
  } else if (channel.loading) {
    content = <SplashScreen label="Preparing silent delivery" />;
  } else if (pairing.status === 'restoring') {
    content = <SplashScreen label="Finding your pair" />;
  } else if (pairing.status === 'unpaired') {
    content = (
      <PairingScreen
        deviceName={DEVICE_NAME}
        onCreatePair={pairing.createPair}
        onJoinPair={pairing.joinPair}
        onOpenHaptics={() => openHaptics('main')}
        onOpenSettings={() => setRoute('settings')}
      />
    );
  } else if (pairing.status === 'waiting' && pairing.pairId) {
    content = (
      <WaitingScreen
        code={pairing.pairId}
        deviceName={DEVICE_NAME}
        onLeave={pairing.leavePair}
        onOpenHaptics={() => openHaptics('main')}
        onOpenSettings={() => setRoute('settings')}
      />
    );
  } else if (
    pairing.status === 'linked' &&
    pairing.pairId &&
    pairing.partner
  ) {
    content = (
      <ControllerScreen
        onLeave={pairing.leavePair}
        onOpenHaptics={() => openHaptics('main')}
        onOpenSettings={() => setRoute('settings')}
        pairId={pairing.pairId}
        partner={pairing.partner}
        selfName={DEVICE_NAME}
        uid={auth.uid}
      />
    );
  } else {
    content = <SplashScreen label="Opening the link" />;
  }

  return (
    <View style={styles.root}>
      {content}
      <UpdateBanner
        onDismiss={appUpdate.dismiss}
        onUpdate={appUpdate.applyUpdate}
        update={appUpdate.update}
        visible={
          route === 'main' &&
          appUpdate.bannerVisible &&
          appUpdate.phase === 'available'
        }
      />
      <IncomingBanner pulse={incomingPulse} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });
