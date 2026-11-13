import { useEffect, useState } from 'react'

/**
 * Live Firebase data as React state: who is signed in, one document, or the
 * results of a query. Each hook returns `[value, loading, error]`.
 *
 * These replace the react-firebase-hooks package. They work on the same
 * `auth` and `firestore` objects as the rest of the app (lib/firebase.js), so
 * `user` here is the same kind of object as `auth.currentUser`.
 */

/** `[user, loading, error]`. `user` is null when signed out. */
export function useAuthState(auth) {
  const [state, setState] = useState(() => {
    const user = auth.currentUser
    // Already known on client-side navigations; unknown on first load
    return { user, loading: !user, error: undefined }
  })

  useEffect(() => {
    return auth.onAuthStateChanged(
      user => setState({ user, loading: false, error: undefined }),
      error => setState({ user: null, loading: false, error })
    )
  }, [auth])

  return [state.user, state.loading, state.error]
}

// `firestore.doc('users/x')` written inline makes a new object every render.
// Keep hold of the first one for as long as they point at the same place, so
// the listener isn't torn down and set up again on every render.
function useStableTarget(target) {
  const [stable, setStable] = useState(target)
  const same =
    stable === target ||
    (!!stable && !!target && typeof stable.isEqual === 'function' && stable.isEqual(target))
  if (!same) {
    setStable(target)
    return target
  }
  return stable
}

const idle = { value: undefined, loading: false, error: undefined }
const waiting = { value: undefined, loading: true, error: undefined }

function useSnapshotValue(target, toValue) {
  const stable = useStableTarget(target)
  const [listening, setListening] = useState(stable)
  const [state, setState] = useState(stable ? waiting : idle)

  // Pointed somewhere else: forget the old value straight away rather than
  // showing it for a render under the new document's name.
  let current = state
  if (listening !== stable) {
    current = stable ? waiting : idle
    setListening(stable)
    setState(current)
  }

  useEffect(() => {
    if (!stable) return undefined
    return stable.onSnapshot(
      snapshot => setState({ value: toValue(snapshot), loading: false, error: undefined }),
      error => setState({ value: undefined, loading: false, error })
    )
    // toValue only depends on idField, which callers pass as a literal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stable])

  return [current.value, current.loading, current.error]
}

function documentData(snapshot, idField) {
  if (!snapshot.exists) return undefined
  return idField ? { ...snapshot.data(), [idField]: snapshot.id } : snapshot.data()
}

/**
 * `[data, loading, error]` for one document, kept up to date. `data` is
 * undefined while loading and when the document doesn't exist. Pass
 * `{ idField: 'id' }` to add the document's id to the data. A null `ref`
 * means "nothing to load yet".
 */
export function useDocumentData(ref, { idField } = {}) {
  return useSnapshotValue(ref, snapshot => documentData(snapshot, idField))
}

/**
 * `[rows, loading, error]` for a collection or query, kept up to date.
 * `rows` is undefined until the first result arrives.
 */
export function useCollectionData(query, { idField } = {}) {
  return useSnapshotValue(query, snapshot => snapshot.docs.map(doc => documentData(doc, idField)))
}
