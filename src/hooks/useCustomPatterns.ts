import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CustomPattern } from '../types';

const STORAGE_KEY = '@vibelink/customPatterns';
const MAX_CUSTOM_PATTERNS = 8;

function parsePatterns(value: unknown): CustomPattern[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const patterns: CustomPattern[] = [];
  for (const entry of value) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as CustomPattern).id !== 'string' ||
      typeof (entry as CustomPattern).label !== 'string' ||
      !Array.isArray((entry as CustomPattern).timings) ||
      (entry as CustomPattern).timings.length < 2
    ) {
      continue;
    }
    const pattern = entry as CustomPattern;
    patterns.push({
      id: pattern.id,
      label: pattern.label,
      timings: pattern.timings.filter(
        item => typeof item === 'number' && Number.isFinite(item),
      ),
      amplitudes: Array.isArray(pattern.amplitudes)
        ? pattern.amplitudes.filter(
            item => typeof item === 'number' && Number.isFinite(item),
          )
        : [],
      createdAt: typeof pattern.createdAt === 'number' ? pattern.createdAt : 0,
    });
  }
  return patterns.slice(0, MAX_CUSTOM_PATTERNS);
}

export function useCustomPatterns() {
  const [patterns, setPatterns] = useState<CustomPattern[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        if (!active || !saved) {
          return;
        }
        try {
          setPatterns(parsePatterns(JSON.parse(saved)));
        } catch {
          // A corrupt list simply starts empty.
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const addPattern = useCallback(
    (label: string, timings: number[], amplitudes: number[]) => {
      const pattern: CustomPattern = {
        id: `c_${Date.now().toString(36)}`,
        label: label.trim().slice(0, 24) || 'Custom pulse',
        timings: [...timings],
        amplitudes: [...amplitudes],
        createdAt: Date.now(),
      };
      setPatterns(current => {
        const next = [pattern, ...current].slice(0, MAX_CUSTOM_PATTERNS);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      return pattern;
    },
    [],
  );

  const removePattern = useCallback((id: string) => {
    setPatterns(current => {
      const next = current.filter(pattern => pattern.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { patterns, ready, addPattern, removePattern };
}
