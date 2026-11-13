// PRIVATE COPY ONLY (screenshot harness): same module as the app's, pointed
// at the local Firebase emulators so nothing reads or writes production.
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'

import FIREBASE_CONFIG from './firebase-config'

if (firebase.apps.length === 0) {
  firebase.initializeApp({ ...FIREBASE_CONFIG, projectId: 'demo-bublr' })
  firebase.firestore().settings({ experimentalForceLongPolling: true, merge: true })
  firebase.firestore().useEmulator('127.0.0.1', 8080)
  firebase.auth().useEmulator('http://127.0.0.1:9099', { disableWarnings: true })
}

export const auth = firebase.auth()
export const firestore = firebase.firestore()
if (typeof window !== 'undefined') window.__firebase = firebase
export default firebase
