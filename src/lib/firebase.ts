import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const env = import.meta.env;
const useEmulator = env.VITE_USE_EMULATOR === '1';

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: useEmulator ? 'demo-recipelewis' : env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: useEmulator ? 'demo-recipelewis.appspot.com' : env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID || 'demo-app',
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (useEmulator) {
  const host = window.location.hostname;
  connectAuthEmulator(auth, 'http://' + host + ':9099', { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
}
