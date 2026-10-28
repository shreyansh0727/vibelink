import { useCallback, useEffect, useState } from 'react';
import {
  getDatabase,
  onValue,
  ref,
  remove,
} from '@react-native-firebase/database';
import { parseSharedRhythm } from '../lib/language';
import type { SharedRhythm } from '../types';

const MAX_VISIBLE_SHARES = 8;

export function useSharedRhythms(pairId: string, selfUid: string) {
  const [shares, setShares] = useState<SharedRhythm[]>([]);

  useEffect(() => {
    const sharedRef = ref(getDatabase(), `pairs/${pairId}/shared`);
    const unsubscribe = onValue(
      sharedRef,
      snapshot => {
        const raw = snapshot.val();
        const next: SharedRhythm[] = [];
        if (raw && typeof raw === 'object') {
          for (const [shareId, value] of Object.entries(raw)) {
            const share = parseSharedRhythm(shareId, value);
            if (share && share.from !== selfUid) {
              next.push(share);
            }
          }
        }
        next.sort((left, right) => right.createdAt - left.createdAt);
        setShares(next.slice(0, MAX_VISIBLE_SHARES));
      },
      () => {
        // The card simply stays empty when the inbox cannot be read.
      },
    );
    return () => unsubscribe();
  }, [pairId, selfUid]);

  const dismiss = useCallback(
    async (shareId: string) => {
      await remove(ref(getDatabase(), `pairs/${pairId}/shared/${shareId}`));
    },
    [pairId],
  );

  return { shares, dismiss };
}
