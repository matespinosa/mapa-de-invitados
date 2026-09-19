/// <reference types="vite/client" />
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore/lite';
import type { Guest } from './seating';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const cloudConfigured = Object.values(config).every(Boolean);

function services() {
  if (!cloudConfigured) return null;
  const app = getApps().length ? getApp() : initializeApp(config);
  return { auth: getAuth(app), database: getFirestore(app) };
}

export function watchAccount(
  next: (user: User | null) => void,
  error: (message: string) => void,
) {
  const service = services();
  if (!service) return () => {};
  return onAuthStateChanged(service.auth, next, (cause) => error(cause.message));
}

export async function signInWithGoogle() {
  const service = services();
  if (!service) throw new Error('Google aún no está configurado.');
  await signInWithPopup(service.auth, new GoogleAuthProvider());
}

export async function signOutOfGoogle() {
  const service = services();
  if (service) await signOut(service.auth);
}

export async function readCloudPlan(uid: string) {
  const service = services();
  if (!service) return null;
  const snapshot = await getDoc(doc(service.database, 'plans', uid));
  return snapshot.exists() ? snapshot.data().guests : null;
}

export async function writeCloudPlan(uid: string, guests: Guest[]) {
  const service = services();
  if (!service) throw new Error('Google aún no está configurado.');
  await setDoc(doc(service.database, 'plans', uid), {
    guests,
    updatedAt: serverTimestamp(),
  });
}
