type CodedError = {
  code?: unknown;
  message?: unknown;
};

function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  const code = (error as CodedError).code;
  return typeof code === 'string' ? code : '';
}

function errorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  const message = (error as CodedError).message;
  return typeof message === 'string' ? message : '';
}

export function isPermissionDenied(error: unknown): boolean {
  const code = errorCode(error).toLowerCase();
  const message = errorMessage(error).toLowerCase();
  return (
    code === 'database/permission-denied' ||
    message.includes('permission_denied') ||
    message.includes('permission denied')
  );
}

export function isNetworkError(error: unknown): boolean {
  const code = errorCode(error).toLowerCase();
  const message = errorMessage(error).toLowerCase();
  return (
    code === 'auth/network-request-failed' ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('timeout')
  );
}

export function describeAuthError(error: unknown): string {
  const code = errorCode(error);

  if (code === 'auth/operation-not-allowed') {
    return 'Anonymous sign-in is disabled in Firebase. Enable it in Authentication → Sign-in method, then try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Firebase could not be reached. Check your internet connection and try again.';
  }
  if (
    code === 'auth/invalid-api-key' ||
    code === 'auth/api-key-not-valid' ||
    messageIncludes(error, 'api-key')
  ) {
    return 'The Firebase API key does not match this build. Replace android/app/google-services.json and rebuild the app.';
  }
  if (messageIncludes(error, 'no firebase app')) {
    return 'Firebase was not initialized. Add android/app/google-services.json and rebuild the app.';
  }

  return `VibeLink could not start a secure session.${code ? ` (${code})` : ''}`;
}

export function describeDeliveryError(error: unknown): string {
  const code = errorCode(error);

  if (isPermissionDenied(error)) {
    return 'Firebase rejected access to the notification token. Deploy database.rules.json, then try again.';
  }
  if (isNetworkError(error)) {
    return 'The delivery channel could not reach Firebase. Check your internet connection and try again.';
  }
  if (
    messageIncludes(error, 'no firebase app') ||
    messageIncludes(error, 'google-services') ||
    messageIncludes(error, 'not initialized')
  ) {
    return 'Firebase is not configured for this build. Add android/app/google-services.json and rebuild the app.';
  }

  return `Silent delivery could not be connected.${code ? ` (${code})` : ''}`;
}

export function describePairError(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Firebase is unreachable. Check your internet connection and try again.';
  }

  const code = errorCode(error);
  return `The pair could not be loaded.${code ? ` (${code})` : ''}`;
}

export function describeUpdateError(error: unknown): string {
  const code = errorCode(error);

  if (code === 'update_checksum_failed') {
    return 'The downloaded file did not match the published checksum, so it was deleted. Try again.';
  }
  if (code === 'update_download_failed') {
    const detail = errorMessage(error);
    return detail
      ? `The update could not be downloaded. ${detail}`
      : 'The update could not be downloaded. Check your connection and try again.';
  }
  if (code === 'update_permission_required') {
    return 'Android needs permission to install this update. Allow installs for VibeLink, then try again.';
  }
  if (code === 'update_missing_file') {
    return 'The downloaded update is no longer on this phone. Download it again.';
  }
  if (code === 'update_install_failed') {
    return 'Android could not open the installer. Try again.';
  }
  if (isPermissionDenied(error)) {
    return 'Firebase rejected the update check. Deploy database.rules.json, then try again.';
  }
  if (isNetworkError(error)) {
    return 'The update server could not be reached. Check your internet connection and try again.';
  }

  return `The update check failed.${code ? ` (${code})` : ''}`;
}

export function describeOtaError(error: unknown): string {
  const code = errorCode(error);

  if (code === 'ota_checksum_failed') {
    return 'The downloaded JS bundle did not match the published checksum, so it was deleted. Try again.';
  }
  if (code === 'ota_download_failed') {
    const detail = errorMessage(error);
    return detail
      ? `The JS bundle could not be downloaded. ${detail}`
      : 'The JS bundle could not be downloaded. Check your connection and try again.';
  }
  if (code === 'ota_missing_bundle') {
    return 'The downloaded JS bundle is no longer on this phone. Download it again.';
  }
  if (code === 'ota_bad_url' || code === 'ota_bad_checksum' || code === 'ota_bad_id') {
    return 'The published JS bundle metadata is not valid. Republish the bundle.';
  }
  if (isPermissionDenied(error)) {
    return 'Firebase rejected the JS bundle check. Deploy database.rules.json, then try again.';
  }
  if (isNetworkError(error)) {
    return 'The JS bundle server could not be reached. Check your internet connection and try again.';
  }

  return `The JS bundle update failed.${code ? ` (${code})` : ''}`;
}

function messageIncludes(error: unknown, text: string): boolean {
  return errorMessage(error).toLowerCase().includes(text);
}
