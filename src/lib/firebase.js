import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'

import FIREBASE_CONFIG from './firebase-config'

if (firebase.apps.length === 0) {
  firebase.initializeApp(FIREBASE_CONFIG)
  firebase.firestore().settings({ experimentalForceLongPolling: true, merge: true })
} 

export const auth = firebase.auth()
export const firestore = firebase.firestore()
export default firebase