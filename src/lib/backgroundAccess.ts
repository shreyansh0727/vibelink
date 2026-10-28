import { NativeModules, Platform } from 'react-native';
import type { BatteryStatus } from './batteryState';

type VibeLinkBatteryNative = {
  getStatus(): Promise<BatteryStatus>;
  requestUnrestricted(): Promise<boolean>;
  openAppSettings(): Promise<boolean>;
};

const nativeBattery = NativeModules.VibeLinkBattery as
  | VibeLinkBatteryNative
  | undefined;

export const batteryControlsAvailable =
  Platform.OS === 'android' && Boolean(nativeBattery);

export function readBatteryStatus(): Promise<BatteryStatus> {
  if (!nativeBattery) {
    return Promise.reject(new Error('Battery controls are unavailable.'));
  }
  return nativeBattery.getStatus();
}

export function requestBatteryUnrestricted(): Promise<boolean> {
  if (!nativeBattery) {
    return Promise.reject(new Error('Battery controls are unavailable.'));
  }
  return nativeBattery.requestUnrestricted();
}

export function openBatteryAppSettings(): Promise<boolean> {
  if (!nativeBattery) {
    return Promise.reject(new Error('Battery controls are unavailable.'));
  }
  return nativeBattery.openAppSettings();
}
