// Firebase's "compat" entry points keep the namespaced API this codebase is
// written against (firestore.collection('users').doc(id), auth.signOut(), …)
// on top of the current SDK, so pages and API routes didn't have to change
// when the SDK was upgraded from v8.
import firebase from 'firebase/compat/app'
import 'firebase/compat/auth'
import 'firebase/compat/firestore'

import FIREBASE_CONFIG from './firebase-config'

if (firebase.apps.length === 0) {
  firebase.initializeApp(FIREBASE_CONFIG)
  firebase.firestore().settings({
    experimentalForceLongPolling: true,
    // On by default in the current SDK, and it refuses to be combined with "force"
    experimentalAutoDetectLongPolling: false,
    merge: true,
  })
}

export const auth = firebase.auth()
export const firestore = firebase.firestore()
export default firebase
