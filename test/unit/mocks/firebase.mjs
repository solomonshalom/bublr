// In-memory stand-in for src/lib/firebase.js (Firebase v8 web SDK shape), so
// API handlers can be exercised in tests without touching a real project.
// The test loader (../loader.mjs) swaps it in for every import of lib/firebase.

const store = new Map() // collectionPath -> Map(id -> data)
let autoId = 0

// Deep copy that keeps Timestamps and Dates as real instances (like Firestore)
function clone(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value
  if (value instanceof Timestamp) return new Timestamp(value.ms)
  if (value instanceof Date) return new Date(value.getTime())
  if (Array.isArray(value)) return value.map(clone)
  if (value instanceof Sentinel) return value
  const out = {}
  for (const [key, inner] of Object.entries(value)) out[key] = clone(inner)
  return out
}

class Sentinel {
  constructor(kind, value) {
    this.kind = kind
    this.value = value
  }
}

const FieldValue = {
  increment: n => new Sentinel('increment', n),
  arrayUnion: (...items) => new Sentinel('arrayUnion', items),
  arrayRemove: (...items) => new Sentinel('arrayRemove', items),
  serverTimestamp: () => new Sentinel('serverTimestamp'),
  delete: () => new Sentinel('delete'),
}

class Timestamp {
  constructor(ms) {
    this.ms = ms
  }
  static now() {
    return new Timestamp(Date.now())
  }
  static fromDate(d) {
    return new Timestamp(d.getTime())
  }
  toDate() {
    return new Date(this.ms)
  }
  toMillis() {
    return this.ms
  }
}

function applyValue(current, value) {
  if (!(value instanceof Sentinel)) return value
  switch (value.kind) {
    case 'increment':
      return (typeof current === 'number' ? current : 0) + value.value
    case 'arrayUnion': {
      const arr = Array.isArray(current) ? [...current] : []
      for (const item of value.value) if (!arr.some(x => JSON.stringify(x) === JSON.stringify(item))) arr.push(item)
      return arr
    }
    case 'arrayRemove': {
      const arr = Array.isArray(current) ? current : []
      return arr.filter(x => !value.value.some(item => JSON.stringify(x) === JSON.stringify(item)))
    }
    case 'serverTimestamp':
      return new Date()
    default:
      return undefined
  }
}

function setPath(obj, path, value) {
  const keys = path.split('.')
  let target = obj
  for (const key of keys.slice(0, -1)) {
    if (typeof target[key] !== 'object' || target[key] === null) target[key] = {}
    target = target[key]
  }
  const last = keys[keys.length - 1]
  const next = applyValue(target[last], value)
  if (next === undefined) delete target[last]
  else target[last] = next
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

function collectionMap(path) {
  if (!store.has(path)) store.set(path, new Map())
  return store.get(path)
}

class DocSnapshot {
  constructor(ref, data) {
    this.ref = ref
    this.id = ref.id
    this.exists = data !== undefined
    this._data = data
  }
  data() {
    return clone(this._data)
  }
}

class DocRef {
  constructor(collectionPath, id) {
    this.collectionPath = collectionPath
    this.id = id
    this.path = `${collectionPath}/${id}`
  }
  async get() {
    return new DocSnapshot(this, clone(collectionMap(this.collectionPath).get(this.id)))
  }
  async set(data, options = {}) {
    const map = collectionMap(this.collectionPath)
    const base = options.merge ? clone(map.get(this.id)) || {} : {}
    for (const [key, value] of Object.entries(data)) setPath(base, key, value)
    map.set(this.id, base)
  }
  async update(data) {
    const map = collectionMap(this.collectionPath)
    if (!map.has(this.id)) {
      const err = new Error(`No document to update: ${this.path}`)
      err.code = 'not-found'
      throw err
    }
    const doc = clone(map.get(this.id))
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) throw new Error(`Unsupported field value: undefined (${key})`)
      setPath(doc, key, value)
    }
    map.set(this.id, doc)
  }
  async delete() {
    collectionMap(this.collectionPath).delete(this.id)
  }
  collection(name) {
    return new Query(`${this.path}/${name}`)
  }
}

class Query {
  constructor(path, filters = [], order = null, max = null) {
    this.path = path
    this.filters = filters
    this.order = order
    this.max = max
  }
  doc(id) {
    return new DocRef(this.path, id || `auto${++autoId}`)
  }
  async add(data) {
    const ref = this.doc()
    await ref.set(data)
    return ref
  }
  where(field, op, value) {
    return new Query(this.path, [...this.filters, { field, op, value }], this.order, this.max)
  }
  orderBy(field, dir = 'asc') {
    return new Query(this.path, this.filters, { field, dir }, this.max)
  }
  limit(n) {
    return new Query(this.path, this.filters, this.order, n)
  }
  async get() {
    let rows = [...collectionMap(this.path).entries()]
    const value = v => (v instanceof Date ? v.getTime() : v instanceof Timestamp ? v.ms : v)
    for (const { field, op, value: expected } of this.filters) {
      rows = rows.filter(([, data]) => {
        const actual = value(getPath(data, field))
        const want = value(expected)
        switch (op) {
          case '==':
            return actual === want
          case '<':
            return actual < want
          case 'array-contains':
            return Array.isArray(actual) && actual.includes(want)
          default:
            throw new Error(`mock firestore: unsupported op ${op}`)
        }
      })
    }
    if (this.order) {
      const { field, dir } = this.order
      rows = rows.filter(([, data]) => getPath(data, field) !== undefined)
      rows.sort(([, a], [, b]) => {
        const x = value(getPath(a, field))
        const y = value(getPath(b, field))
        return dir === 'desc' ? (x < y ? 1 : x > y ? -1 : 0) : x < y ? -1 : x > y ? 1 : 0
      })
    }
    if (this.max != null) rows = rows.slice(0, this.max)
    const docs = rows.map(([id, data]) => new DocSnapshot(new DocRef(this.path, id), clone(data)))
    return { docs, empty: docs.length === 0, size: docs.length, forEach: fn => docs.forEach(fn) }
  }
}

class Batch {
  constructor() {
    this.ops = []
  }
  set(ref, data, options) {
    this.ops.push(() => ref.set(data, options))
    return this
  }
  update(ref, data) {
    this.ops.push(() => ref.update(data))
    return this
  }
  delete(ref) {
    this.ops.push(() => ref.delete())
    return this
  }
  async commit() {
    for (const op of this.ops) await op()
  }
}

export const firestore = {
  collection: name => new Query(name),
  doc: path => {
    const parts = path.split('/')
    return new DocRef(parts.slice(0, -1).join('/'), parts[parts.length - 1])
  },
  batch: () => new Batch(),
  settings: () => {},
}

export const auth = { currentUser: null, signOut: async () => {} }

const firebase = {
  firestore: Object.assign(() => firestore, { FieldValue, Timestamp }),
  auth: () => auth,
  apps: [{}],
}

export default firebase

// ---- test helpers ----
export function resetStore() {
  store.clear()
  autoId = 0
}

export function seed(collectionPath, id, data) {
  collectionMap(collectionPath).set(id, clone(data))
}

export function read(collectionPath, id) {
  return clone(collectionMap(collectionPath).get(id))
}

export function all(collectionPath) {
  return [...collectionMap(collectionPath).entries()].map(([id, data]) => ({ id, ...clone(data) }))
}

export { Timestamp, FieldValue }
