import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { buzzWaveform, type BuzzPayload } from './haptics';

export type TorchState = {
  available: boolean;
  permission: boolean;
  flashEnabled: boolean;
};

type NativeTorch = {
  getState(): Promise<TorchState>;
  setFlashEnabled(enabled: boolean): Promise<TorchState>;
  setTorch(enabled: boolean): Promise<boolean>;
  flashPattern(
    timings: number[],
    amplitudes?: number[],
  ): Promise<boolean>;
};

const nativeTorch = NativeModules.VibeLinkTorch as NativeTorch | undefined;

export const torchControlsAvailable =
  Platform.OS === 'android' && Boolean(nativeTorch);

export const TORCH_UNAVAILABLE: TorchState = {
  available: false,
  permission: false,
  flashEnabled: false,
};

export function readTorchState(): Promise<TorchState> {
  if (!nativeTorch) {
    return Promise.resolve(TORCH_UNAVAILABLE);
  }
  return nativeTorch.getState();
}

export function setFlashEnabled(enabled: boolean): Promise<TorchState> {
  if (!nativeTorch) {
    return Promise.resolve(TORCH_UNAVAILABLE);
  }
  return nativeTorch.setFlashEnabled(enabled);
}

export async function requestCameraAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Allow flashlight control',
        message:
          'VibeLink uses the camera only to switch the flashlight. Nothing is captured or stored.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function flashWithPulse(
  payload: BuzzPayload | string | undefined,
): Promise<void> {
  if (!nativeTorch) {
    return;
  }
  const { timings, amplitudes } = buzzWaveform(payload);
  await nativeTorch.flashPattern(timings, amplitudes);
}

export function applyTorchCommand(value: unknown): Promise<void> {
  if (!nativeTorch) {
    return Promise.resolve();
  }
  const on = value === true || value === 'on';
  return nativeTorch
    .setTorch(on)
    .then(() => undefined)
    .catch(() => {});
}
