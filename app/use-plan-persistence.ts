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

// Keep the previous draft under v2; this PDF revision starts a fresh saved plan.
const STORAGE_KEY = 'ensulugar-recepcion-v3-pdf-20260919';
const accountKey = (uid: string) => `${STORAGE_KEY}:account:${uid}`;
const pendingKey = (uid: string) => `${STORAGE_KEY}:pending:${uid}`;

type SaveState = 'loading' | 'local' | 'saving' | 'cloud' | 'error';

function localDraft(key: string): Guest[] | null {
  const value = localStorage.getItem(key);
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  return validateGuests(parsed) ? parsed : null;
}

export function usePlanPersistence() {
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [account, setAccount] = useState<User | null>(null);
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
        try {
          setGuests(localDraft(STORAGE_KEY) ?? initialGuests);
          setSaveState('local');
          setReady(true);
        } catch {
          setGuests(initialGuests);
          setSaveError('No se pudo leer el borrador de este dispositivo.');
          setSaveState('error');
          setReady(true);
        }
        return;
      }

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
        setSaveError(message);
        setSaveState('error');
      });
      return () => {
        alive = false;
        generation++;
        stop();
      };
    }

    void loadAccount(null);
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
    ready,
    saveState,
    saveError,
    retryCloud,
    cloudConfigured,
  };
}
