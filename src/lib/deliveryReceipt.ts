import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { getDatabase, ref, update } from '@react-native-firebase/database';

const PAIR_STORAGE_KEY = '@vibelink/pair';
const AUTH_TIMEOUT_MS = 3000;
const RECEIPT_TIMEOUT_MS = 5000;

function currentUid(): Promise<string | null> {
  const auth = getAuth();
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser.uid);
  }

  return new Promise(resolve => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    const finish = (uid: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      unsubscribe?.();
      resolve(uid);
    };
    const timer = setTimeout(() => finish(null), AUTH_TIMEOUT_MS);
    unsubscribe = onAuthStateChanged(
      auth,
      user => finish(user ? user.uid : null),
      () => finish(null),
    );
  });
}

export function recordDelivery(triggerId: unknown): Promise<void> {
  if (
    typeof triggerId !== 'string' ||
    triggerId.length === 0 ||
    triggerId.length > 64
  ) {
    return Promise.resolve();
  }
  return writeReceipt(triggerId);
}

async function writeReceipt(triggerId: string): Promise<void> {
  try {
    const [uid, pairCode] = await Promise.all([
      currentUid(),
      AsyncStorage.getItem(PAIR_STORAGE_KEY),
    ]);
    if (!uid || !pairCode) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        update(ref(getDatabase(), `pairs/${pairCode}/members/${uid}`), {
          lastDeliveredTrigger: triggerId,
          lastDeliveredAt: Date.now(),
        }),
        new Promise<void>(resolve => {
          timer = setTimeout(resolve, RECEIPT_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  } catch {
    // A missing receipt never affects delivery; the phone already buzzed.
  }
}
