import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'

import FIREBASE_CONFIG from './firebase-config'

// For SSR compatibility
const isBrowser = typeof window !== 'undefined';

// Initialize Firebase only on the client-side
if (isBrowser && !firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
  
  // Performance optimizations for Firestore
  const firestoreSettings = {
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true,
  };
  
  // Enable offline persistence in production
  if (process.env.NODE_ENV === 'production') {
    firestoreSettings.experimentalForceLongPolling = false;
    firebase.firestore().enablePersistence({ synchronizeTabs: true })
      .catch((err) => {
        if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
          console.error("Firestore persistence error:", err.code);
        }
      });
  }
  
  firebase.firestore().settings(firestoreSettings);
}

// Create empty objects for server-side rendering
const emptyAuth = {
  currentUser: null,
  onAuthStateChanged: () => (() => {}),
  signInWithPopup: () => Promise.resolve({}),
  signOut: () => Promise.resolve({}),
};

const emptyFirestore = {
  collection: () => ({
    doc: () => ({
      get: () => Promise.resolve({ exists: false, data: () => ({}) }),
      set: () => Promise.resolve(),
      update: () => Promise.resolve(),
    }),
    where: () => ({
      get: () => Promise.resolve({ docs: [] }),
      onSnapshot: () => (() => {}),
    }),
  }),
  doc: (path) => ({
    get: () => Promise.resolve({ exists: false, data: () => ({}) }),
    collection: () => emptyFirestore.collection(),
  }),
  batch: () => ({
    set: () => {},
    update: () => {},
    delete: () => {},
    commit: () => Promise.resolve(),
  }),
};

// Export the appropriate objects based on environment
export const auth = isBrowser ? firebase.auth() : emptyAuth;
export const firestore = isBrowser ? firebase.firestore() : emptyFirestore;

// Add direct access to Firebase methods for compatibility
if (!isBrowser) {
  firebase.auth = () => emptyAuth;
  firebase.firestore = () => emptyFirestore;
}

export default firebase;
