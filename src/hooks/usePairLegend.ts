import { useCallback, useEffect, useState } from 'react';
import {
  getDatabase,
  onValue,
  ref,
  remove,
  set,
} from '@react-native-firebase/database';
import { isBuiltInPattern, sanitizeMeaning } from '../lib/language';

export function usePairLegend(pairId: string) {
  const [meanings, setMeanings] = useState<Record<string, string>>({});

  useEffect(() => {
    const legendRef = ref(getDatabase(), `pairs/${pairId}/legend`);
    const unsubscribe = onValue(
      legendRef,
      snapshot => {
        const raw = snapshot.val();
        const next: Record<string, string> = {};
        if (raw && typeof raw === 'object') {
          for (const [patternId, value] of Object.entries(raw)) {
            if (!isBuiltInPattern(patternId)) {
              continue;
            }
            const meaning = sanitizeMeaning(value);
            if (meaning) {
              next[patternId] = meaning;
            }
          }
        }
        setMeanings(next);
      },
      () => {
        // A missing legend keeps the defaults; the write path reports errors.
      },
    );
    return () => unsubscribe();
  }, [pairId]);

  const saveMeaning = useCallback(
    async (patternId: string, text: string) => {
      if (!isBuiltInPattern(patternId)) {
        throw new Error('Unknown feel.');
      }
      const meaning = sanitizeMeaning(text);
      const target = ref(getDatabase(), `pairs/${pairId}/legend/${patternId}`);
      if (meaning) {
        await set(target, meaning);
      } else {
        await remove(target);
      }
    },
    [pairId],
  );

  return { meanings, saveMeaning };
}
