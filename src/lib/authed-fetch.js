import { auth } from './firebase'

/**
 * fetch() that proves who the signed-in user is. Adds the Firebase ID token as
 * `Authorization: Bearer <token>` so API routes can verify the caller with
 * lib/server-auth.js instead of trusting a userId in the request body.
 *
 * Works exactly like fetch otherwise; if nobody is signed in the request goes
 * out without a token and the route answers 401.
 */
export async function authedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {})
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(url, { ...options, headers })
}

export default authedFetch
