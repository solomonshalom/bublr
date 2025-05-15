import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'

import FIREBASE_CONFIG from './firebase-config'

// Initialize Firebase only on client-side
if (typeof window !== 'undefined' && firebase.apps.length === 0) {
  firebase.initializeApp(FIREBASE_CONFIG)
  
  // Performance optimizations for Firestore
  const firestoreSettings = {
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true,
  };
  
  // Enable offline persistence for better user experience
  if (process.env.NODE_ENV === 'production') {
    firestoreSettings.experimentalForceLongPolling = false;
    firebase.firestore().enablePersistence({ synchronizeTabs: true })
      .catch((err) => {
        console.error("Firestore persistence error:", err.code);
      });
  }
  
  firebase.firestore().settings(firestoreSettings);
}

// Lazy-loaded auth and firestore to avoid SSR issues
let _auth, _firestore;

// Helper function to get auth instance
const getAuth = () => {
  if (!_auth) {
    _auth = firebase.auth();
  }
  return _auth;
};

// Helper function to get firestore instance
const getFirestore = () => {
  if (!_firestore) {
    _firestore = firebase.firestore();
  }
  return _firestore;
};

export const auth = typeof window !== 'undefined' ? getAuth() : null;
export const firestore = typeof window !== 'undefined' ? getFirestore() : null;
export default firebase;
