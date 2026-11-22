/**
 * Server-side helpers for Profile HTML (see lib/profile-code.js): load the
 * public data a page can use, and read/write the code and its history.
 */

import firebase, { firestore } from './firebase'
import { toPublicUser } from './public-user'
import { signProfileCode } from './profile-code-signature'
import {
  buildTemplateData,
  extractFriendNames,
  MAX_FRIENDS,
  MAX_REVISIONS,
  byteLength,
} from './profile-code'

export const REVISIONS_COLLECTION = 'profileCodeRevisions'

const toIso = value => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'string') return value
  return null
}

/** Approved guest book entries, newest first (same rules as the classic profile). */
export async function loadApprovedGuestbook(uid, limit = 24) {
  try {
    const snapshot = await firestore.collection('users').doc(uid).collection('guestbook').limit(100).get()
    return snapshot.docs
      .map(doc => doc.data())
      .filter(entry => entry && entry.moderationStatus === 'approved')
      .map(entry => ({
        name: entry.name,
        message: entry.message || '',
        signaturePath: entry.signaturePath,
        signatureViewBox: entry.signatureViewBox,
        createdAt: toIso(entry.createdAt),
      }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, limit)
  } catch (error) {
    console.error('Profile HTML: guest book failed to load:', error.message)
    return []
  }
}

/** Public name and picture for each username that exists (for <bublr-friends>). */
export async function loadFriends(names) {
  const out = {}
  // Usernames match exactly, as in profile URLs
  const unique = [...new Set((names || []).map(n => String(n)))].slice(0, MAX_FRIENDS)
  await Promise.all(
    unique.map(async name => {
      try {
        const snap = await firestore.collection('users').where('name', '==', name).limit(1).get()
        const doc = snap.docs[0]
        if (!doc || !doc.exists) return
        const u = doc.data()
        out[name] = { name: u.name || name, displayName: u.displayName || u.name || name, photo: u.photo || '' }
      } catch (_) {
        // a friend that fails to load is simply left out
      }
    })
  )
  return out
}

/**
 * Everything a page's template tags and window.bublr can see, for a user
 * loaded with getUserByName. `html` decides which friends get looked up.
 */
export async function loadTemplateData(user, html) {
  const publicUser = toPublicUser(user)
  const [guestbook, friends] = await Promise.all([
    user.guestbookVisibility === false ? [] : loadApprovedGuestbook(user.id),
    loadFriends(extractFriendNames(html)),
  ])
  return buildTemplateData(publicUser, { guestbook, friends })
}

/** The stored code in the shape the editor uses. */
export function storedCode(profileCode) {
  const c = profileCode && typeof profileCode === 'object' ? profileCode : {}
  return {
    html: typeof c.html === 'string' ? c.html : '',
    css: typeof c.css === 'string' ? c.css : '',
    js: typeof c.js === 'string' ? c.js : '',
    mode: ['off', 'block', 'page'].includes(c.mode) ? c.mode : 'off',
    placement: c.placement === 'top' ? 'top' : 'bottom',
    version: Number.isFinite(c.version) ? c.version : 0,
    updatedAt: toIso(c.updatedAt),
  }
}

export async function listRevisions(uid, limit = MAX_REVISIONS) {
  const snapshot = await firestore
    .collection('users')
    .doc(uid)
    .collection(REVISIONS_COLLECTION)
    .orderBy('savedAt', 'desc')
    .limit(limit)
    .get()
  return snapshot.docs.map(doc => {
    const r = doc.data()
    return {
      id: doc.id,
      savedAt: toIso(r.savedAt),
      version: Number.isFinite(r.version) ? r.version : null,
      mode: r.mode || 'off',
      size: Number.isFinite(r.size) ? r.size : byteLength(`${r.html || ''}${r.css || ''}${r.js || ''}`),
      source: r.source || 'editor',
    }
  })
}

export async function getRevision(uid, id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null
  const doc = await firestore.collection('users').doc(uid).collection(REVISIONS_COLLECTION).doc(id).get()
  if (!doc.exists) return null
  const r = doc.data()
  return {
    id: doc.id,
    html: r.html || '',
    css: r.css || '',
    js: r.js || '',
    mode: r.mode || 'off',
    placement: r.placement === 'top' ? 'top' : 'bottom',
    savedAt: toIso(r.savedAt),
    version: Number.isFinite(r.version) ? r.version : null,
  }
}

/** Keep the newest MAX_REVISIONS snapshots. */
export async function pruneRevisions(uid) {
  const snapshot = await firestore
    .collection('users')
    .doc(uid)
    .collection(REVISIONS_COLLECTION)
    .orderBy('savedAt', 'desc')
    .get()
  const extra = snapshot.docs.slice(MAX_REVISIONS)
  await Promise.all(extra.map(doc => doc.ref.delete()))
  return extra.length
}

export class VersionConflict extends Error {
  constructor(current) {
    super('Your code was changed somewhere else since you opened it')
    this.name = 'VersionConflict'
    this.current = current
  }
}

/**
 * Save the code. In a transaction so two tabs can't silently overwrite each
 * other: pass the version the editor started from as `baseVersion`, or
 * `force` to overwrite anyway. Returns { version, updatedAt, codeChanged }.
 */
export async function saveProfileCode(uid, value, { baseVersion, force = false, source = 'editor' } = {}) {
  const userRef = firestore.collection('users').doc(uid)
  const now = firebase.firestore.Timestamp.now()

  const result = await firestore.runTransaction(async transaction => {
    const snap = await transaction.get(userRef)
    if (!snap.exists) {
      const err = new Error('Profile not found')
      err.status = 404
      throw err
    }
    const current = storedCode(snap.data().profileCode)
    if (!force && Number.isFinite(baseVersion) && baseVersion !== current.version) {
      throw new VersionConflict(current)
    }
    const codeChanged = current.html !== value.html || current.css !== value.css || current.js !== value.js
    const version = current.version + 1
    const profileCode = {
      html: value.html,
      css: value.css,
      js: value.js,
      mode: value.mode,
      placement: value.placement,
      version,
      updatedAt: now,
    }
    profileCode.sig = signProfileCode(uid, profileCode)
    transaction.update(userRef, { profileCode })
    return { version, codeChanged }
  })

  if (result.codeChanged) {
    await userRef.collection(REVISIONS_COLLECTION).add({
      html: value.html,
      css: value.css,
      js: value.js,
      mode: value.mode,
      placement: value.placement,
      version: result.version,
      size: byteLength(value.html) + byteLength(value.css) + byteLength(value.js),
      source,
      savedAt: now,
    })
    try {
      await pruneRevisions(uid)
    } catch (error) {
      console.error('Profile HTML: pruning history failed:', error.message)
    }
  }

  return { ...result, updatedAt: toIso(now) }
}
