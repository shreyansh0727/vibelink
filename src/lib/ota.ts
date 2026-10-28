import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { get, getDatabase, ref } from '@react-native-firebase/database';
import {
  parseBundleInfo,
  type OtaBundleInfo,
  type OtaState,
} from './bundleInfo';

export type { OtaBundleInfo, OtaState } from './bundleInfo';

export type OtaProgress = {
  id: string;
  downloadedBytes: number;
  totalBytes: number;
  status: 'running' | 'verifying' | 'completed';
};

type NativeOta = {
  confirmLoaded(): Promise<boolean>;
  getState(): Promise<OtaState>;
  download(
    url: string,
    sha256: string,
    id: string,
    versionName: string,
    sizeBytes: number,
  ): Promise<{ id: string; versionName: string; sizeBytes: number }>;
  activate(id: string, versionName: string): Promise<boolean>;
  cancelPending(): Promise<boolean>;
  reset(): Promise<boolean>;
  dismissRejected(): Promise<boolean>;
  restart(): Promise<boolean>;
};

type ProgressEmitter = {
  addListener(
    eventName: string,
    listener: (progress: OtaProgress) => void,
  ): { remove(): void };
};

const native = NativeModules.VibeLinkOta as NativeOta | undefined;

export const otaAvailable = Platform.OS === 'android' && Boolean(native);

const OTA_PATH = 'appBundles/latest';

export async function confirmOtaLoaded(): Promise<void> {
  if (!native) {
    return;
  }
  try {
    await native.confirmLoaded();
  } catch {
    // The boot guard keeps a bundle only when JS reports a clean start; a
    // failed report just means the bundle gets one more chance next launch.
  }
}

export async function fetchLatestBundle(): Promise<OtaBundleInfo | null> {
  const snapshot = await get(ref(getDatabase(), OTA_PATH));
  return parseBundleInfo(snapshot.val());
}

export async function readOtaState(): Promise<OtaState | null> {
  if (!native) {
    return null;
  }
  try {
    const state = await native.getState();
    return {
      runningId: state.runningId ?? null,
      runningVersion: state.runningVersion ?? null,
      pendingId: state.pendingId ?? null,
      pendingVersion: state.pendingVersion ?? null,
      rejectedId: state.rejectedId ?? null,
      rejectedVersion: state.rejectedVersion ?? null,
    };
  } catch {
    return null;
  }
}

export async function downloadBundle(
  info: OtaBundleInfo,
  onProgress: (progress: OtaProgress) => void,
): Promise<void> {
  if (!native) {
    throw new Error('In-app JS updates need the Android build of VibeLink.');
  }
  const emitter = new NativeEventEmitter(
    native as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
  ) as unknown as ProgressEmitter;
  const subscription = emitter.addListener('vibeLinkOtaProgress', progress => {
    if (progress.id === info.id) {
      onProgress(progress);
    }
  });
  try {
    await native.download(
      info.url,
      info.sha256,
      info.id,
      info.versionName,
      info.sizeBytes,
    );
  } finally {
    subscription.remove();
  }
}

export async function activateBundle(
  id: string,
  versionName: string,
): Promise<void> {
  if (!native) {
    return;
  }
  await native.activate(id, versionName);
}

export async function cancelPendingBundle(): Promise<void> {
  if (!native) {
    return;
  }
  await native.cancelPending();
}

export async function resetToBuiltIn(): Promise<void> {
  if (!native) {
    return;
  }
  await native.reset();
}

export async function dismissRejectedBundle(): Promise<void> {
  if (!native) {
    return;
  }
  await native.dismissRejected();
}

export async function restartApp(): Promise<void> {
  if (!native) {
    return;
  }
  await native.restart();
}
