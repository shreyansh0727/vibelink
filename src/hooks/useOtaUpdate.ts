import { useCallback, useEffect, useRef, useState } from 'react';
import { describeOtaError } from '../lib/errors';
import { bundleApplies, isBundleCurrent } from '../lib/bundleInfo';
import {
  activateBundle,
  cancelPendingBundle,
  dismissRejectedBundle,
  downloadBundle,
  fetchLatestBundle,
  otaAvailable,
  readOtaState,
  resetToBuiltIn,
  restartApp,
  type OtaBundleInfo,
  type OtaProgress,
  type OtaState,
} from '../lib/ota';
import type { InstalledVersion } from '../lib/updates';

export type OtaPhase =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'pending'
  | 'error';

export type AppBundle = {
  available: boolean;
  installed: InstalledVersion | null;
  info: OtaBundleInfo | null;
  state: OtaState | null;
  phase: OtaPhase;
  progress: OtaProgress | null;
  error: string | null;
  check: () => void;
  install: () => void;
  restart: () => void;
  useBuiltIn: () => void;
  discard: () => void;
  dismissRejected: () => void;
};

export function useOtaUpdate(installed: InstalledVersion | null): AppBundle {
  const [state, setState] = useState<OtaState | null>(null);
  const [info, setInfo] = useState<OtaBundleInfo | null>(null);
  const [phase, setPhase] = useState<OtaPhase>('idle');
  const [progress, setProgress] = useState<OtaProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const versionCode = installed?.versionCode ?? null;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (showChecking: boolean) => {
      if (!otaAvailable || versionCode === null) {
        return;
      }
      const current = await readOtaState();
      if (!mounted.current) {
        return;
      }
      setState(current);
      if (current?.pendingId) {
        setPhase('pending');
        return;
      }
      if (showChecking) {
        setPhase('checking');
        setError(null);
      }
      try {
        const latest = await fetchLatestBundle();
        if (!mounted.current) {
          return;
        }
        if (
          latest &&
          bundleApplies(latest, versionCode) &&
          !(current && isBundleCurrent(latest, current))
        ) {
          setInfo(latest);
          setPhase('available');
        } else {
          setInfo(null);
          setPhase('current');
        }
      } catch (checkError) {
        if (!mounted.current) {
          return;
        }
        setError(describeOtaError(checkError));
        setPhase('error');
      }
    },
    [versionCode],
  );

  useEffect(() => {
    load(false).catch(() => {});
  }, [load]);

  const check = useCallback(() => {
    load(true).catch(() => {});
  }, [load]);

  const install = useCallback(async () => {
    if (!info || phase === 'downloading') {
      return;
    }
    setError(null);
    setPhase('downloading');
    setProgress({
      id: info.id,
      downloadedBytes: 0,
      totalBytes: info.sizeBytes,
      status: 'running',
    });
    try {
      await downloadBundle(info, next => {
        if (mounted.current) {
          setProgress(next);
        }
      });
      await activateBundle(info.id, info.versionName);
      const next = await readOtaState();
      if (mounted.current) {
        setState(next);
        setProgress(null);
        setInfo(null);
        setPhase('pending');
      }
    } catch (downloadError) {
      if (mounted.current) {
        setProgress(null);
        setError(describeOtaError(downloadError));
        setPhase('error');
      }
    }
  }, [info, phase]);

  const restart = useCallback(() => {
    restartApp().catch((restartError: unknown) => {
      setError(describeOtaError(restartError));
      setPhase('error');
    });
  }, []);

  const useBuiltIn = useCallback(async () => {
    try {
      await resetToBuiltIn();
      await restartApp();
    } catch (resetError) {
      if (mounted.current) {
        setError(describeOtaError(resetError));
        setPhase('error');
      }
    }
  }, []);

  const discard = useCallback(async () => {
    try {
      await cancelPendingBundle();
      if (!mounted.current) {
        return;
      }
      const next = await readOtaState();
      if (mounted.current) {
        setState(next);
        setInfo(null);
        setPhase('current');
      }
    } catch (discardError) {
      if (mounted.current) {
        setError(describeOtaError(discardError));
        setPhase('error');
      }
    }
  }, []);

  const dismissRejected = useCallback(async () => {
    try {
      await dismissRejectedBundle();
      if (mounted.current) {
        setState(current =>
          current
            ? { ...current, rejectedId: null, rejectedVersion: null }
            : current,
        );
      }
    } catch {
      // The message is cosmetic; it can stay on screen.
    }
  }, []);

  return {
    available: otaAvailable,
    installed,
    info,
    state,
    phase,
    progress,
    error,
    check,
    install: () => {
      install().catch(() => {});
    },
    restart,
    useBuiltIn: () => {
      useBuiltIn().catch(() => {});
    },
    discard: () => {
      discard().catch(() => {});
    },
    dismissRejected: () => {
      dismissRejected().catch(() => {});
    },
  };
}
