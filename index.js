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
import { isDeliveryPaused } from './src/lib/privacy';
import { name as appName } from './app.json';

// Foreground pulses are handled in useIncomingPulse; this runs when the app is
// backgrounded or terminated.
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  if (remoteMessage.data?.type !== 'buzz') {
    return;
  }
  if (await isDeliveryPaused()) {
    return;
  }
  vibrateBuzz(remoteMessage.data);
  await recordDelivery(remoteMessage.data.triggerId);
});

AppRegistry.registerComponent(appName, () => App);
