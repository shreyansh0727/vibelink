import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { get, getDatabase, ref } from '@react-native-firebase/database';
import { parseUpdateInfo, type UpdateInfo } from './updateInfo';

export type InstalledVersion = {
  versionName: string;
  versionCode: number;
};

export type DownloadProgress = {
  downloadId: number;
  downloadedBytes: number;
  totalBytes: number;
  status: 'running' | 'verifying' | 'completed';
};

type NativeUpdater = {
  getVersion(): Promise<InstalledVersion>;
  canInstallPackages(): Promise<boolean>;
  openInstallPermission(): Promise<boolean>;
  download(
    url: string,
    sha256: string,
    versionCode: number,
    versionName: string,
  ): Promise<{ path: string; sizeBytes: number }>;
  install(path: string): Promise<boolean>;
};

type ProgressEmitter = {
  addListener(
    eventName: string,
    listener: (progress: DownloadProgress) => void,
  ): { remove(): void };
};

const native = NativeModules.VibeLinkUpdater as NativeUpdater | undefined;

export const updatesAvailable = Platform.OS === 'android' && Boolean(native);

const UPDATE_PATH = 'appUpdates/latest';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CHECK_STAMP_KEY = '@vibelink/updateCheckedAt';
const DISMISSED_KEY = '@vibelink/updateDismissed';

export async function readInstalledVersion(): Promise<InstalledVersion | null> {
  if (!native) {
    return null;
  }
  try {
    return await native.getVersion();
  } catch {
    return null;
  }
}

export async function fetchLatestUpdate(): Promise<UpdateInfo | null> {
  const snapshot = await get(ref(getDatabase(), UPDATE_PATH));
  return parseUpdateInfo(snapshot.val());
}

export async function canInstallPackages(): Promise<boolean> {
  if (!native) {
    return false;
  }
  try {
    return await native.canInstallPackages();
  } catch {
    return false;
  }
}

export async function openInstallPermission(): Promise<void> {
  if (!native) {
    return;
  }
  await native.openInstallPermission();
}

export async function downloadUpdate(
  info: UpdateInfo,
  onProgress: (progress: DownloadProgress) => void,
): Promise<{ path: string; sizeBytes: number }> {
  if (!native) {
    throw new Error('Updates need the Android build of VibeLink.');
  }
  const emitter = new NativeEventEmitter(
    native as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
  ) as unknown as ProgressEmitter;
  const subscription = emitter.addListener(
    'vibeLinkUpdateProgress',
    onProgress,
  );
  try {
    return await native.download(
      info.apkUrl,
      info.sha256,
      info.versionCode,
      info.versionName,
    );
  } finally {
    subscription.remove();
  }
}

export async function installUpdate(path: string): Promise<void> {
  if (!native) {
    return;
  }
  await native.install(path);
}

export async function isUpdateCheckDue(now: number = Date.now()): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(CHECK_STAMP_KEY);
    const lastCheck = stored ? Number.parseInt(stored, 10) : Number.NaN;
    if (!Number.isFinite(lastCheck)) {
      return true;
    }
    return now - lastCheck >= CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

export async function markUpdateChecked(
  now: number = Date.now(),
): Promise<void> {
  try {
    await AsyncStorage.setItem(CHECK_STAMP_KEY, String(now));
  } catch {
    // A failed stamp only means the next launch checks again.
  }
}

export async function readDismissedVersion(): Promise<number | null> {
  try {
    const stored = await AsyncStorage.getItem(DISMISSED_KEY);
    const versionCode = stored ? Number.parseInt(stored, 10) : Number.NaN;
    return Number.isFinite(versionCode) ? versionCode : null;
  } catch {
    return null;
  }
}

export async function markUpdateDismissed(versionCode: number): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, String(versionCode));
  } catch {
    // Dismissal is cosmetic; failing to store it just shows the banner again.
  }
}
