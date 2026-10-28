import { useEffect, useState } from 'react';
import { getMessaging, onMessage } from '@react-native-firebase/messaging';
import { recordDelivery } from '../lib/deliveryReceipt';
import { vibrateBuzz } from '../lib/haptics';
import { patternFor } from '../lib/patterns';
import { isDeliveryPaused } from '../lib/privacy';
import type { IncomingPulse } from '../types';

const BANNER_LIFETIME_MS = 4200;

export function useIncomingPulse(): IncomingPulse | null {
  const [pulse, setPulse] = useState<IncomingPulse | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onMessage(getMessaging(), async message => {
        const data = message.data;
        if (data?.type !== 'buzz') {
          return;
        }
        if (await isDeliveryPaused()) {
          return;
        }

        vibrateBuzz(data);
        recordDelivery(data.triggerId).catch(() => {});
        const pattern =
          typeof data.pattern === 'string' ? data.pattern : 'tap';
        const label =
          typeof data.label === 'string' && data.label.trim()
            ? data.label.trim()
            : patternFor(pattern).label;

        setPulse({
          id: `${Date.now()}-${Math.random()}`,
          pattern,
          label,
          fromName:
            typeof data.fromName === 'string' && data.fromName.trim()
              ? data.fromName
              : 'Your other phone',
          receivedAt: Date.now(),
        });
      });
    } catch {
      // Delivery setup failures are handled by the notification channel hook.
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!pulse) {
      return;
    }

    const timer = setTimeout(() => {
      setPulse(current => (current?.id === pulse.id ? null : current));
    }, BANNER_LIFETIME_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [pulse]);

  return pulse;
}
