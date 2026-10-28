import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from '@react-native-firebase/auth';
import { describeAuthError } from '../lib/errors';

type AuthState = {
  uid: string | null;
  loading: boolean;
  error: string | null;
};

export function useAnonymousAuth() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AuthState>({
    uid: null,
    loading: true,
    error: null,
  });
  const signingIn = useRef(false);

  useEffect(() => {
    let active = true;
    signingIn.current = false;
    setState({ uid: null, loading: true, error: null });

    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(
      auth,
      user => {
        if (!active) {
          return;
        }

        if (user) {
          signingIn.current = false;
          setState({ uid: user.uid, loading: false, error: null });
          return;
        }

        if (signingIn.current) {
          return;
        }

        signingIn.current = true;
        signInAnonymously(auth).catch(error => {
          if (!active) {
            return;
          }
          signingIn.current = false;
          setState({
            uid: null,
            loading: false,
            error: describeAuthError(error),
          });
        });
      },
      error => {
        if (!active) {
          return;
        }
        signingIn.current = false;
        setState({
          uid: null,
          loading: false,
          error: describeAuthError(error),
        });
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setAttempt(value => value + 1);
  }, []);

  return { ...state, retry };
}
