import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithFirebase = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      // In native mobile WebView (Capacitor Android), popup login is unsupported and gives "The requested action is invalid". Use redirect.
      await signInWithRedirect(auth, googleProvider);
      return null;
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    // Fallback: If popup is not supported or fails with invalid action, try redirect
    if (error?.code === 'auth/operation-not-supported-in-this-environment' || error?.code === 'auth/cancelled-popup-request' || Capacitor.isNativePlatform()) {
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectError) {
        console.error("Redirect fallback error:", redirectError);
        throw redirectError;
      }
    }
    throw error;
  }
};

export const logoutFromFirebase = async () => {
  return signOut(auth);
};

