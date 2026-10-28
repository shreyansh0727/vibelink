import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  DEFAULT_PRIVACY_STATE,
  privacyControlsAvailable,
  readPrivacyState,
  setDeliveryPaused,
  setPrivacyMode,
  subscribePrivacyChanges,
} from '../lib/privacy';
import type { PrivacyState } from '../lib/privacy';

export function usePrivacy() {
  const [state, setState] = useState<PrivacyState>(DEFAULT_PRIVACY_STATE);
  const [loading, setLoading] = useState(privacyControlsAvailable);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!privacyControlsAvailable) {
      setLoading(false);
      return;
    }
    readPrivacyState()
      .then(setState)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!privacyControlsAvailable) {
      return;
    }
    return subscribePrivacyChanges(next => {
      setState(next);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') {
        refresh();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [refresh]);

  const apply = useCallback(async (work: () => Promise<PrivacyState>) => {
    setBusy(true);
    try {
      setState(await work());
    } finally {
      setBusy(false);
    }
  }, []);

  const enablePrivacyMode = useCallback(
    (enabled: boolean) => apply(() => setPrivacyMode(enabled)),
    [apply],
  );

  const pauseDelivery = useCallback(
    (paused: boolean) => apply(() => setDeliveryPaused(paused)),
    [apply],
  );

  return {
    available: privacyControlsAvailable,
    state,
    loading,
    busy,
    refresh,
    enablePrivacyMode,
    pauseDelivery,
  };
}
