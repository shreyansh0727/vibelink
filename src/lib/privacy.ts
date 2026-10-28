import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export type PrivacyState = {
  privacyMode: boolean;
  disguised: boolean;
  paused: boolean;
};

type NativePrivacy = {
  getState(): Promise<PrivacyState>;
  setPrivacyMode(enabled: boolean): Promise<PrivacyState>;
  setPaused(paused: boolean): Promise<PrivacyState>;
  isPaused(): Promise<boolean>;
};

const native = NativeModules.VibeLinkPrivacy as NativePrivacy | undefined;

export const privacyControlsAvailable =
  Platform.OS === 'android' && Boolean(native);

export const DEFAULT_PRIVACY_STATE: PrivacyState = {
  privacyMode: false,
  disguised: false,
  paused: false,
};

export async function readPrivacyState(): Promise<PrivacyState> {
  if (!native) {
    return DEFAULT_PRIVACY_STATE;
  }
  try {
    return await native.getState();
  } catch {
    return DEFAULT_PRIVACY_STATE;
  }
}

export async function setPrivacyMode(enabled: boolean): Promise<PrivacyState> {
  if (!native) {
    return DEFAULT_PRIVACY_STATE;
  }
  return native.setPrivacyMode(enabled);
}

export async function setDeliveryPaused(
  paused: boolean,
): Promise<PrivacyState> {
  if (!native) {
    return DEFAULT_PRIVACY_STATE;
  }
  return native.setPaused(paused);
}

export async function isDeliveryPaused(): Promise<boolean> {
  if (!native) {
    return false;
  }
  try {
    return await native.isPaused();
  } catch {
    return false;
  }
}

type PrivacyEventEmitter = {
  addListener(
    eventName: string,
    listener: (state: PrivacyState) => void,
  ): { remove(): void };
};

export function subscribePrivacyChanges(
  listener: (state: PrivacyState) => void,
): () => void {
  if (!native) {
    return () => {};
  }
  const emitter = new NativeEventEmitter(
    native as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
  ) as unknown as PrivacyEventEmitter;
  const subscription = emitter.addListener('vibeLinkPrivacyChanged', listener);
  return () => subscription.remove();
}
