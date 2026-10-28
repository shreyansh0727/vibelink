import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { describeUpdateError } from '../lib/errors';
import { isNewerVersion, type UpdateInfo } from '../lib/updateInfo';
import {
  canInstallPackages,
  downloadUpdate,
  fetchLatestUpdate,
  installUpdate,
  isUpdateCheckDue,
  markUpdateChecked,
  markUpdateDismissed,
  openInstallPermission,
  readDismissedVersion,
  readInstalledVersion,
  updatesAvailable,
  type DownloadProgress,
  type InstalledVersion,
} from '../lib/updates';

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export type AppUpdate = {
  available: boolean;
  installed: InstalledVersion | null;
  update: UpdateInfo | null;
  phase: UpdatePhase;
  error: string | null;
  progress: DownloadProgress | null;
  needsPermission: boolean;
  bannerVisible: boolean;
  checkLatest: () => void;
  applyUpdate: () => void;
  allowInstalls: () => void;
  dismiss: () => void;
};

export function useAppUpdate(uid: string | null): AppUpdate {
  const [installed, setInstalled] = useState<InstalledVersion | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const installedRef = useRef<InstalledVersion | null>(null);

  const loadInstalled = useCallback(async () => {
    if (installedRef.current) {
      return installedRef.current;
    }
    const version = await readInstalledVersion();
    installedRef.current = version;
    setInstalled(version);
    return version;
  }, []);

  const check = useCallback(
    async (silent: boolean) => {
      if (!uid || !updatesAvailable) {
        return;
      }
      if (!silent) {
        setPhase('checking');
        setError(null);
      }
      try {
        const [latest, current] = await Promise.all([
          fetchLatestUpdate(),
          loadInstalled(),
        ]);
        await markUpdateChecked();
        if (latest && current && isNewerVersion(latest, current.versionCode)) {
          setUpdate(latest);
          setPhase('available');
          const dismissed = await readDismissedVersion();
          if (dismissed !== latest.versionCode) {
            setBannerVisible(true);
          }
        } else {
          setUpdate(null);
          setPhase('current');
        }
      } catch (checkError) {
        if (!silent) {
          setError(describeUpdateError(checkError));
          setPhase('error');
        }
      }
    },
    [uid, loadInstalled],
  );

  useEffect(() => {
    if (!uid || !updatesAvailable) {
      return;
    }
    let cancelled = false;
    (async () => {
      const version = await loadInstalled();
      if (cancelled || !version) {
        return;
      }
      if (await isUpdateCheckDue()) {
        await check(true);
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid, loadInstalled, check]);

  const launchInstaller = useCallback(async (filePath: string) => {
    try {
      const allowed = await canInstallPackages();
      setNeedsPermission(!allowed);
      if (!allowed) {
        return;
      }
      await installUpdate(filePath);
    } catch (installError) {
      setError(describeUpdateError(installError));
      setPhase('error');
    }
  }, []);

  const runUpdate = useCallback(async () => {
    if (!update || phase === 'downloading' || phase === 'checking') {
      return;
    }
    if (path) {
      await launchInstaller(path);
      return;
    }
    setBannerVisible(false);
    setError(null);
    setPhase('downloading');
    setProgress({
      downloadId: 0,
      downloadedBytes: 0,
      totalBytes: update.sizeBytes,
      status: 'running',
    });
    try {
      const result = await downloadUpdate(update, setProgress);
      setPath(result.path);
      setProgress(null);
      setPhase('ready');
      await launchInstaller(result.path);
    } catch (downloadError) {
      setProgress(null);
      setError(describeUpdateError(downloadError));
      setPhase('error');
    }
  }, [update, phase, path, launchInstaller]);

  useEffect(() => {
    if (!needsPermission || !path) {
      return;
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        return;
      }
      (async () => {
        if (await canInstallPackages()) {
          await launchInstaller(path);
        }
      })().catch(() => {});
    });
    return () => subscription.remove();
  }, [needsPermission, path, launchInstaller]);

  const checkLatest = useCallback(() => {
    check(false).catch(() => {});
  }, [check]);

  const applyUpdate = useCallback(() => {
    runUpdate().catch(() => {});
  }, [runUpdate]);

  const allowInstalls = useCallback(() => {
    setNeedsPermission(true);
    setError(null);
    openInstallPermission().catch((permissionError: unknown) => {
      setError(describeUpdateError(permissionError));
    });
  }, []);

  const dismiss = useCallback(() => {
    setBannerVisible(false);
    if (update) {
      markUpdateDismissed(update.versionCode).catch(() => {});
    }
  }, [update]);

  return {
    available: updatesAvailable,
    installed,
    update,
    phase,
    error,
    progress,
    needsPermission,
    bannerVisible,
    checkLatest,
    applyUpdate,
    allowInstalls,
    dismiss,
  };
}
