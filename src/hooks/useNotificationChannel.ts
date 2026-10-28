import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getDatabase, ref, set } from '@react-native-firebase/database';
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import { describeDeliveryError } from '../lib/errors';

type ChannelState = {
  ready: boolean;
  loading: boolean;
  error: string | null;
};

export function useNotificationChannel(uid: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ChannelState>({
    ready: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!uid) {
      setState({ ready: false, loading: true, error: null });
      return;
    }

    let active = true;
    let unsubscribeRefresh: (() => void) | undefined;
    let appStateSubscription:
      | ReturnType<typeof AppState.addEventListener>
      | undefined;
    setState({ ready: false, loading: true, error: null });

    const persistToken = async (token: string) => {
      await set(
        ref(getDatabase(), `notificationTokens/${uid}`),
        { token, updatedAt: Date.now() },
      );
    };

    const markReady = () => {
      if (active) {
        setState({ ready: true, loading: false, error: null });
      }
    };

    try {
      const messaging = getMessaging();

      unsubscribeRefresh = onTokenRefresh(messaging, token => {
        persistToken(token).then(markReady).catch(() => {
          // The current token remains usable; the next app start retries.
        });
      });

      getToken(messaging)
        .then(token => persistToken(token).then(markReady))
        .catch(error => {
          if (active) {
            setState({
              ready: false,
              loading: false,
              error: describeDeliveryError(error),
            });
          }
        });

      // FCM tokens can rotate while the app is backgrounded, and the relay
      // removes tokens that FCM reports as unregistered. Re-persist on every
      // foreground so the stored token is current before the next pulse.
      appStateSubscription = AppState.addEventListener('change', next => {
        if (next !== 'active' || !active) {
          return;
        }
        getToken(messaging)
          .then(persistToken)
          .then(markReady)
          .catch(() => {
            // Keep the last known state; the next foreground retries.
          });
      });
    } catch (error) {
      setState({
        ready: false,
        loading: false,
        error: describeDeliveryError(error),
      });
    }

    return () => {
      active = false;
      unsubscribeRefresh?.();
      appStateSubscription?.remove();
    };
  }, [uid, attempt]);

  const retry = useCallback(() => {
    setAttempt(value => value + 1);
  }, []);

  return { ...state, retry };
}
