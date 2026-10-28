/**
 * @format
 */

import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import App from './App';
import { recordDelivery } from './src/lib/deliveryReceipt';
import { vibrateBuzz } from './src/lib/haptics';
import { confirmOtaLoaded } from './src/lib/ota';
import { isDeliveryPaused } from './src/lib/privacy';
import { applyTorchCommand, flashWithPulse } from './src/lib/torch';
import { name as appName } from './app.json';

// Reaching this point means a downloaded JS bundle evaluated cleanly, which
// clears its launch guard in the native OTA store.
confirmOtaLoaded();

// Foreground pulses are handled in useIncomingPulse; this runs when the app is
// backgrounded or terminated.
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  const data = remoteMessage.data;
  if (data?.type === 'torch') {
    await applyTorchCommand(data.torch);
    return;
  }
  if (data?.type !== 'buzz') {
    return;
  }
  if (await isDeliveryPaused()) {
    return;
  }
  vibrateBuzz(data);
  flashWithPulse(data).catch(() => {});
  await recordDelivery(data.triggerId);
});

AppRegistry.registerComponent(appName, () => App);
