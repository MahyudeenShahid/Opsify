import { initializeApp, getApps, getApp } from 'firebase/app';
// 👇 REMOVED getAuth from this line
// Use the standard entrypoint; RN auth registration is ensured below.
import { initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const requiredConfigKeys = [
  'apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId',
] as const;
export const isFirebaseConfigured = requiredConfigKeys.every((key) => Boolean(firebaseConfig[key]));

if (!isFirebaseConfigured) {
  console.warn('Firebase environment variables are incomplete.');
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use an explicit type annotation instead of typeof getAuth to avoid importing it at the top level
let auth: any;

if (Platform.OS === 'web') {
  // Require or import dynamically to ensure it doesn't pollute the native bundle registry early
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
} else {
  // Resolve persistence helper from the Firebase auth entrypoint in RN.
  const { getReactNativePersistence } = require('firebase/auth');
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error: any) {
    if (error.code === 'auth/already-initialized') {
      const { getAuth } = require('firebase/auth'); // 👈 Dynamically pulled here safely
      auth = getAuth(app);
    } else {
      throw error;
    }
  }
}

const db = getFirestore(app);

export { app, auth, db };
