// Replaces global fetch with a router so API handlers that call Dodo Payments
// or Vercel can run offline. Every request is recorded for assertions.
//
//   const calls = installFetch(req => ({ status: 200, body: { ok: true } }))
//   calls[0] -> { method, host, path, query, body }

export function installFetch(route) {
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url))
    const call = {
      method: String(init.method || 'GET').toUpperCase(),
      host: u.host,
      path: u.pathname,
      query: Object.fromEntries(u.searchParams),
      body: init.body ? JSON.parse(init.body) : undefined,
      headers: init.headers || {},
    }
    calls.push(call)
    const answer = (await route(call)) || { status: 404, body: { error: { message: 'not mocked' } } }
    if (answer.throws) throw new Error(answer.throws)
    const status = answer.status ?? 200
    const body = answer.body === undefined ? {} : answer.body
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      text: async () => (body === null ? '' : JSON.stringify(body)),
      json: async () => body,
    }
  }
  return calls
}
