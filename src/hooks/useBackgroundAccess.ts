import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  batteryControlsAvailable,
  openBatteryAppSettings,
  readBatteryStatus,
  requestBatteryUnrestricted,
} from '../lib/backgroundAccess';
import type { BatteryStatus } from '../lib/batteryState';

export function useBackgroundAccess() {
  const [status, setStatus] = useState<BatteryStatus | null>(null);
  const [loading, setLoading] = useState(batteryControlsAvailable);
  const [opening, setOpening] = useState(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!batteryControlsAvailable) {
      setLoading(false);
      return;
    }
    try {
      const next = await readBatteryStatus();
      if (mounted.current) {
        setStatus(next);
      }
    } catch {
      // Keep the last known status; the card still offers app settings.
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();

    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        refresh();
      }
    });

    return () => {
      mounted.current = false;
      subscription.remove();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [refresh]);

  const allowUnrestricted = useCallback(async () => {
    setOpening(true);
    try {
      await requestBatteryUnrestricted();
    } catch {
      // The refresh below reflects either outcome; settings remain available.
    }

    timer.current = setTimeout(() => {
      if (mounted.current) {
        setOpening(false);
        refresh();
      }
    }, 1200);
  }, [refresh]);

  const openSettings = useCallback(() => {
    openBatteryAppSettings().catch(() => {});
  }, []);

  return {
    available: batteryControlsAvailable,
    status,
    loading,
    opening,
    allowUnrestricted,
    openSettings,
    refresh,
  };
}
