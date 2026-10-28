import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  TORCH_UNAVAILABLE,
  readTorchState,
  requestCameraAccess,
  setFlashEnabled,
  torchControlsAvailable,
  type TorchState,
} from '../lib/torch';

export function useFlash() {
  const [state, setState] = useState<TorchState>(TORCH_UNAVAILABLE);
  const [loading, setLoading] = useState(torchControlsAvailable);

  const refresh = useCallback(() => {
    if (!torchControlsAvailable) {
      setLoading(false);
      return;
    }
    readTorchState()
      .then(setState)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const toggle = useCallback(
    async (next: boolean) => {
      if (!torchControlsAvailable) {
        return;
      }

      if (next && !state.permission) {
        const granted = await requestCameraAccess();
        setState(await readTorchState().catch(() => state));
        if (!granted) {
          return;
        }
      }

      setState(await setFlashEnabled(next).catch(() => state));
    },
    [state],
  );

  const requestAccess = useCallback(async () => {
    await requestCameraAccess();
    refresh();
  }, [refresh]);

  return {
    ...state,
    loading,
    toggle,
    requestAccess,
    refresh,
  };
}
