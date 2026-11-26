import crypto from 'crypto'
import { open, seal } from '../secret-box'
import { handleDomain } from './config'

/**
 * Each writer who turns the fediverse on gets an RSA key pair. Fediverse
 * servers check the signature on everything Bublr sends for them against the
 * public key in their actor document.
 *
 * The private key is sealed in the writer's user document
 * (`fediverse.keySealed`, lib/secret-box). The public key is never stored on
 * its own: it's derived from the sealed private key whenever it's needed, so
 * a public key written into the (world-writable) document by someone else
 * can't make Bublr vouch for their signatures.
 */

const keyContext = uid => `${uid}:fediverse-key`

export const fediverseEnabled = user => Boolean(user && user.fediverse?.enabled === true && user.name)

/** @name@bublr.life, while the writer has the fediverse on. */
export function fediverseHandle(user) {
  return fediverseEnabled(user) ? `@${user.name}@${handleDomain()}` : null
}

/** A new key pair, sealed for this writer: { keySealed, keyCreatedAt }. */
export function newSealedKey(uid, { now = Date.now() } = {}) {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  return { keySealed: seal(pem, keyContext(uid)), keyCreatedAt: now }
}

/** The writer's private key (PEM), or null if there is none or it doesn't open. */
export function actorPrivateKey(user) {
  const sealed = user?.fediverse?.keySealed
  if (!sealed || !user.id) return null
  try {
    return open(sealed, keyContext(user.id))
  } catch (_) {
    return null
  }
}

const publicKeys = new Map()

/** The public key (PEM) that matches the sealed private key, or null. */
export function actorPublicKeyPem(user) {
  const sealed = user?.fediverse?.keySealed
  if (!sealed) return null
  const cached = publicKeys.get(sealed)
  if (cached) return cached
  const privatePem = actorPrivateKey(user)
  if (!privatePem) return null
  const pem = crypto.createPublicKey(privatePem).export({ type: 'spki', format: 'pem' })
  if (publicKeys.size > 500) publicKeys.clear()
  publicKeys.set(sealed, pem)
  return pem
}
