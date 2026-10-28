import { Platform } from 'react-native';

function readModel(): string {
  const constants = Platform.constants as unknown as Record<string, unknown>;
  const model = typeof constants.Model === 'string' ? constants.Model : '';

  if (
    !model ||
    model.startsWith('sdk_gphone') ||
    model.startsWith('Android SDK built for')
  ) {
    return 'Android emulator';
  }

  return model.replaceAll('_', ' ').slice(0, 36);
}

export const DEVICE_NAME = readModel();
