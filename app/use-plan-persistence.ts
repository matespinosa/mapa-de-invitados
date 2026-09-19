'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  cloudConfigured,
  readCloudPlan,
  watchAccount,
  writeCloudPlan,
} from './cloud-plan';
import { initialGuests, validateGuests, type Guest } from './seating';
import { checkAccess, greetingName } from './allowed-accounts';
import { rememberAccount } from './remembered-accounts';

// Keep the previous draft under v2; this PDF revision starts a fresh saved plan.
const STORAGE_KEY = 'ensulugar-recepcion-v3-pdf-20260919';
const accountKey = (uid: string) => `${STORAGE_KEY}:account:${uid}`;
const pendingKey = (uid: string) => `${STORAGE_KEY}:pending:${uid}`;

type SaveState = 'loading' | 'local' | 'saving' | 'cloud' | 'error';

/** How far an account got towards the organizer. Only 'allowed' opens a plan. */
export type AccessState =
  | { status: 'checking' }
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'not-google' }
  | { status: 'unverified'; email: string }
  | { status: 'denied'; email: string; name: string }
  | { status: 'error'; message: string }
  | { status: 'allowed'; name: string };

function localDraft(key: string): Guest[] | null {
  const value = localStorage.getItem(key);
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  return validateGuests(parsed) ? parsed : null;
}

export function usePlanPersistence() {
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [account, setAccount] = useState<User | null>(null);
  const [access, setAccess] = useState<AccessState>(
    cloudConfigured ? { status: 'checking' } : { status: 'unconfigured' },
  );
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [saveError, setSaveError] = useState('');
  const [retry, setRetry] = useState(0);
  const activeUid = useRef<string | null>(null);
  const currentSignature = useRef('');
  const syncedSignature = useRef<string | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const retryCloud = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    let generation = 0;

    const loadAccount = async (user: User | null) => {
      const turn = ++generation;
      const uid = user?.uid ?? null;
      activeUid.current = uid;
      syncedSignature.current = null;
      setAccount(user);
      setReady(false);
      setGuests(initialGuests);
      setSaveState('loading');
      setSaveError('');

      if (!user) {
        setAccess({ status: 'signed-out' });
        return;
      }

      // Google is the only door, and only the people on the list go through it.
      // A refused account keeps its session so the screen can say why, but no
      // plan is read or written for it.
      const verdict = checkAccess({
        email: user.email,
        emailVerified: user.emailVerified,
        providers: user.providerData.map((entry) => entry.providerId),
      });
      if (verdict.status !== 'allowed') {
        const email = user.email ?? '';
        setAccess(
          verdict.status === 'denied'
            ? { status: 'denied', email, name: greetingName(user.displayName, '') }
            : verdict.status === 'unverified'
              ? { status: 'unverified', email }
              : { status: 'not-google' },
        );
        return;
      }

      const name = greetingName(user.displayName, verdict.name);
      setAccess({ status: 'allowed', name });
      // Next time this device opens the app it can greet by name and go
      // straight to this account instead of asking who is entering.
      rememberAccount({ email: user.email ?? '', name, photo: user.photoURL });

      try {
        const remote = await readCloudPlan(user.uid);
        if (!alive || turn !== generation) return;
        if (remote !== null && !validateGuests(remote)) {
          throw new Error('El plano guardado en la nube no tiene un formato válido.');
        }
        // A pending local change survived an interrupted save: recover it first.
        const pending = localStorage.getItem(pendingKey(user.uid));
        const cached = pending ? localDraft(accountKey(user.uid)) : null;
        if (pending && !cached) {
          throw new Error('Hay cambios pendientes en este dispositivo que no se pudieron leer.');
        }
        const plan = cached ?? remote ?? localDraft(accountKey(user.uid)) ??
          localDraft(STORAGE_KEY) ?? initialGuests;
        syncedSignature.current = cached || remote === null
          ? null
          : JSON.stringify(remote);
        setGuests(plan);
        setSaveState(syncedSignature.current ? 'cloud' : 'saving');
        setReady(true);
      } catch (cause) {
        if (!alive || turn !== generation) return;
        setSaveError(
          cause instanceof Error ? cause.message : 'No se pudo abrir tu plano en la nube.',
        );
        setSaveState('error');
      }
    };

    if (cloudConfigured) {
      const stop = watchAccount(loadAccount, (message) => {
        if (!alive) return;
        setReady(false);
        setAccess({ status: 'error', message });
        setSaveError(message);
        setSaveState('error');
      });
      return () => {
        alive = false;
        generation++;
        stop();
      };
    }

    // Without Firebase there is no way to sign in, so the gate stays shut on the
    // 'unconfigured' state it started with and the login screen explains what is
    // missing instead of opening a plan.
    return () => {
      alive = false;
      generation++;
    };
  }, [retry]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const showState = (state: SaveState, error = '') => queueMicrotask(() => {
      if (!active) return;
      setSaveState(state);
      setSaveError(error);
    });
    const serialized = JSON.stringify(guests);
    currentSignature.current = serialized;

    if (!account) {
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
        showState('local');
      } catch {
        showState('error', 'No se pudo guardar en este dispositivo.');
      }
      return () => { active = false; };
    }

    const uid = account.uid;
    try {
      localStorage.setItem(accountKey(uid), serialized);
      if (syncedSignature.current === serialized) {
        showState('cloud');
        return () => { active = false; };
      }
      localStorage.setItem(pendingKey(uid), '1');
    } catch {
      // A cloud save can still succeed when browser storage is unavailable.
    }
    showState('saving');
    const timer = window.setTimeout(() => {
      const save = writeQueue.current.catch(() => {}).then(() =>
        writeCloudPlan(uid, guests),
      );
      writeQueue.current = save;
      void save.then(() => {
        try {
          if (localStorage.getItem(accountKey(uid)) === serialized) {
            localStorage.removeItem(pendingKey(uid));
          }
        } catch {
          // The cloud copy is already saved.
        }
        if (activeUid.current === uid && currentSignature.current === serialized) {
          syncedSignature.current = serialized;
          setSaveState('cloud');
          setSaveError('');
        }
      }).catch((cause) => {
        if (activeUid.current === uid && currentSignature.current === serialized) {
          setSaveState('error');
          setSaveError(
            cause instanceof Error ? cause.message : 'No se pudo guardar en la nube.',
          );
        }
      });
    }, 700);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [account, guests, ready]);

  return {
    guests,
    setGuests,
    account,
    access,
    ready,
    saveState,
    saveError,
    retryCloud,
    cloudConfigured,
  };
}
