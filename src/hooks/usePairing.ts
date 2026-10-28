import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  get,
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  remove,
  set,
  update,
} from '@react-native-firebase/database';
import {
  describePairError,
  isNetworkError,
  isPermissionDenied,
} from '../lib/errors';
import {
  MAX_PAIR_MEMBERS,
  generatePairCode,
  isValidPairCode,
  normalizePairCode,
} from '../lib/pairingCode';
import type { PairData, PairMember } from '../types';

const PAIR_STORAGE_KEY = '@vibelink/pair';
const PAIR_LOAD_TIMEOUT_MS = 12_000;

export type PairingStatus =
  | 'restoring'
  | 'unpaired'
  | 'waiting'
  | 'linked'
  | 'error';

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePair(value: unknown): PairData | null {
  if (!isRecord(value) || !isRecord(value.members)) {
    return null;
  }

  const members: Record<string, PairMember> = {};
  for (const [memberUid, rawMember] of Object.entries(value.members)) {
    if (!isRecord(rawMember)) {
      continue;
    }
    if (rawMember.uid !== memberUid || typeof rawMember.uid !== 'string') {
      continue;
    }

    const member: PairMember = {
      uid: memberUid,
      name:
        typeof rawMember.name === 'string' && rawMember.name
          ? rawMember.name
          : 'Android phone',
      platform: 'android',
      online: rawMember.online === true,
      joinedAt:
        typeof rawMember.joinedAt === 'number' ? rawMember.joinedAt : 0,
      lastSeen: typeof rawMember.lastSeen === 'number' ? rawMember.lastSeen : 0,
    };
    if (
      typeof rawMember.lastDeliveredTrigger === 'string' &&
      rawMember.lastDeliveredTrigger
    ) {
      member.lastDeliveredTrigger = rawMember.lastDeliveredTrigger;
    }
    if (typeof rawMember.lastDeliveredAt === 'number') {
      member.lastDeliveredAt = rawMember.lastDeliveredAt;
    }
    members[memberUid] = member;
  }

  if (Object.keys(members).length === 0) {
    return null;
  }

  const rawMeta = isRecord(value.meta) ? value.meta : {};
  return {
    meta: {
      createdAt:
        typeof rawMeta.createdAt === 'number' ? rawMeta.createdAt : 0,
      createdBy:
        typeof rawMeta.createdBy === 'string' ? rawMeta.createdBy : '',
    },
    members,
  };
}

function operationError(
  error: unknown,
  fallback: string,
  permissionMessage: string,
): Error {
  if (isPermissionDenied(error)) {
    return new Error(permissionMessage);
  }
  if (isNetworkError(error)) {
    return new Error(
      'Firebase is unreachable. Check your internet connection and try again.',
    );
  }
  return new Error(fallback);
}

export function usePairing(
  uid: string | null,
  deviceName: string,
) {
  const [restored, setRestored] = useState(false);
  const [pairId, setPairId] = useState<string | null>(null);
  const [pair, setPair] = useState<PairData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setRestored(false);
    setPairId(null);
    setPair(null);
    setLoadError(null);

    if (!uid) {
      setRestored(true);
      return () => {
        active = false;
      };
    }

    AsyncStorage.getItem(PAIR_STORAGE_KEY)
      .then(savedCode => {
        if (!active) {
          return;
        }

        if (savedCode) {
          const normalized = normalizePairCode(savedCode);
          if (isValidPairCode(normalized)) {
            setPairId(normalized);
          } else {
            AsyncStorage.removeItem(PAIR_STORAGE_KEY).catch(() => {});
          }
        }
        setRestored(true);
      })
      .catch(() => {
        if (active) {
          setRestored(true);
        }
      });

    return () => {
      active = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !pairId) {
      return;
    }

    let active = true;
    let hasSnapshot = false;
    setPair(null);
    setLoadError(null);

    const timeout = setTimeout(() => {
      if (!active || hasSnapshot) {
        return;
      }
      setLoadError(
        'VibeLink is taking too long to reach your pair. Check your connection, then retry.',
      );
    }, PAIR_LOAD_TIMEOUT_MS);

    const pairRef = ref(getDatabase(), `pairs/${pairId}`);
    const unsubscribe = onValue(
      pairRef,
      snapshot => {
        if (!active) {
          return;
        }

        const parsed = parsePair(snapshot.val());
        if (!parsed || !parsed.members[uid]) {
          clearTimeout(timeout);
          AsyncStorage.removeItem(PAIR_STORAGE_KEY).catch(() => {});
          setPairId(null);
          setPair(null);
          setLoadError(null);
          return;
        }

        hasSnapshot = true;
        clearTimeout(timeout);
        setPair(parsed);
        setLoadError(null);
      },
      error => {
        if (!active) {
          return;
        }
        clearTimeout(timeout);

        if (isPermissionDenied(error)) {
          AsyncStorage.removeItem(PAIR_STORAGE_KEY).catch(() => {});
          setPairId(null);
          setPair(null);
          setLoadError(null);
          return;
        }

        setLoadError(describePairError(error));
      },
    );

    return () => {
      active = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [uid, pairId, subscriptionAttempt]);

  const myMember = uid && pair ? pair.members[uid] : null;
  const hasMembership = Boolean(myMember);
  const peers = useMemo(() => {
    if (!uid || !pair) {
      return [] as PairMember[];
    }
    return Object.values(pair.members)
      .filter(member => member.uid !== uid)
      .sort((left, right) => left.joinedAt - right.joinedAt);
  }, [pair, uid]);

  useEffect(() => {
    if (!uid || !pairId || !hasMembership) {
      return;
    }

    let active = true;
    const memberRef = ref(
      getDatabase(),
      `pairs/${pairId}/members/${uid}`,
    );
    const unsubscribe = onValue(
      ref(getDatabase(), '.info/connected'),
      snapshot => {
        if (!active || snapshot.val() !== true) {
          return;
        }

        onDisconnect(memberRef)
          .update({ online: false, lastSeen: Date.now() })
          .then(() => update(memberRef, { online: true, lastSeen: Date.now() }))
          .catch(() => {});
      },
    );

    return () => {
      active = false;
      unsubscribe();
      onDisconnect(memberRef).cancel().catch(() => {});
    };
  }, [uid, pairId, hasMembership]);

  const createPair = useCallback(async () => {
    if (!uid) {
      throw new Error('Sign-in is still being prepared. Try again in a moment.');
    }

    const database = getDatabase();
    const member: PairMember = {
      uid,
      name: deviceName,
      platform: 'android',
      online: true,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const code = generatePairCode();
      const metaRef = ref(database, `pairs/${code}/meta`);

      let exists;
      try {
        const snapshot = await get(metaRef);
        exists = snapshot.exists();
      } catch (error) {
        throw operationError(
          error,
          'A pairing code could not be created. Try again.',
          'Firebase blocked pairing. Deploy database.rules.json, then try again.',
        );
      }

      if (exists) {
        continue;
      }

      try {
        await set(metaRef, {
          createdAt: Date.now(),
          createdBy: uid,
        });
      } catch (error) {
        if (isPermissionDenied(error)) {
          continue;
        }
        throw operationError(
          error,
          'A pairing code could not be created. Try again.',
          'Firebase blocked pairing. Deploy database.rules.json, then try again.',
        );
      }

      try {
        await set(ref(database, `pairs/${code}/members/${uid}`), member);
      } catch (error) {
        throw operationError(
          error,
          'Your device could not join the new pair. Try again.',
          'Firebase blocked pairing. Deploy database.rules.json, then try again.',
        );
      }

      await AsyncStorage.setItem(PAIR_STORAGE_KEY, code).catch(() => {});
      setPair(null);
      setLoadError(null);
      setPairId(code);
      return;
    }

    throw new Error('Could not secure a pairing code. Please try again.');
  }, [deviceName, uid]);

  const joinPair = useCallback(
    async (input: string) => {
      if (!uid) {
        throw new Error(
          'Sign-in is still being prepared. Try again in a moment.',
        );
      }

      const code = normalizePairCode(input);
      if (!isValidPairCode(code)) {
        throw new Error('A pairing code is eight characters. Check the code.');
      }

      const database = getDatabase();

      let metaSnapshot;
      try {
        metaSnapshot = await get(ref(database, `pairs/${code}/meta`));
      } catch (error) {
        throw operationError(
          error,
          'The pair could not be reached. Try again.',
          'Firebase blocked the lookup. Deploy database.rules.json, then try again.',
        );
      }

      if (!metaSnapshot.exists()) {
        throw new Error(
          'No active pair matches that code. Check it and try again.',
        );
      }

      let memberSnapshot;
      try {
        memberSnapshot = await get(ref(database, `pairs/${code}/members`));
      } catch (error) {
        throw operationError(
          error,
          'The pair could not be reached. Try again.',
          'Firebase blocked the lookup. Deploy database.rules.json, then try again.',
        );
      }

      if (Object.keys(memberSnapshot.val() ?? {}).length >= MAX_PAIR_MEMBERS) {
        throw new Error(
          `This pair already has ${MAX_PAIR_MEMBERS} phones. Ask someone to unlink one first.`,
        );
      }

      const member: PairMember = {
        uid,
        name: deviceName,
        platform: 'android',
        online: true,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      };

      try {
        await set(ref(database, `pairs/${code}/members/${uid}`), member);
      } catch (error) {
        throw operationError(
          error,
          `This phone could not join that pair. It may already have ${MAX_PAIR_MEMBERS} phones.`,
          'This pair is full, or Firebase rules have not been deployed.',
        );
      }

      await AsyncStorage.setItem(PAIR_STORAGE_KEY, code).catch(() => {});
      setPair(null);
      setLoadError(null);
      setPairId(code);
    },
    [deviceName, uid],
  );

  const leavePair = useCallback(async () => {
    if (!uid || !pairId) {
      return;
    }

    const database = getDatabase();
    const memberRef = ref(database, `pairs/${pairId}/members/${uid}`);

    try {
      await onDisconnect(memberRef).cancel().catch(() => {});
      await remove(memberRef);
    } catch (error) {
      throw operationError(
        error,
        'This phone could not be unlinked. Check your connection and try again.',
        'Firebase blocked unlinking this phone. Check database.rules.json.',
      );
    }

    await AsyncStorage.removeItem(PAIR_STORAGE_KEY).catch(() => {});
    setPairId(null);
    setPair(null);
    setLoadError(null);
  }, [pairId, uid]);

  const retry = useCallback(() => {
    setLoadError(null);
    setPair(null);
    setSubscriptionAttempt(value => value + 1);
  }, []);

  let status: PairingStatus;
  if (!uid || !restored) {
    status = 'restoring';
  } else if (loadError) {
    status = 'error';
  } else if (!pairId) {
    status = 'unpaired';
  } else if (!pair) {
    status = 'restoring';
  } else if (peers.length > 0) {
    status = 'linked';
  } else {
    status = 'waiting';
  }

  return {
    status,
    pairId,
    pair,
    myMember,
    peers,
    error: loadError,
    createPair,
    joinPair,
    leavePair,
    retry,
  };
}
