// Node module hooks for the unit tests:
//  - resolve extensionless relative imports the way Next's bundler does
//    ('../lib/db' -> '../lib/db.js' or '../lib/db/index.js')
//  - swap Firebase, Resend and Groq for in-memory mocks so API handlers run offline
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const srcLib = path.resolve(here, '../../src/lib')

const PACKAGE_MOCKS = new Map([['groq-sdk', pathToFileURL(path.join(here, 'mocks/groq.mjs')).href]])

const MOCKS = new Map([
  [path.join(srcLib, 'firebase'), pathToFileURL(path.join(here, 'mocks/firebase.mjs')).href],
  [path.join(srcLib, 'resend'), pathToFileURL(path.join(here, 'mocks/resend.mjs')).href],
])

export async function resolve(specifier, context, nextResolve) {
  if (PACKAGE_MOCKS.has(specifier)) return { url: PACKAGE_MOCKS.get(specifier), shortCircuit: true }
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
  if (isRelative && context.parentURL && context.parentURL.startsWith('file:')) {
    const target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    const withoutExt = target.replace(/\.js$/, '')
    if (MOCKS.has(withoutExt)) return { url: MOCKS.get(withoutExt), shortCircuit: true }

    try {
      return await nextResolve(specifier, context)
    } catch (error) {
      for (const suffix of ['.js', '/index.js']) {
        try {
          return await nextResolve(specifier + suffix, context)
        } catch (_) {
          // try the next candidate
        }
      }
      throw error
    }
  }
  return nextResolve(specifier, context)
}
