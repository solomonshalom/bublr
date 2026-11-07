/**
 * The bits of the Vercel REST API that attach writers' domains to this
 * project. Server side only.
 *
 *   VERCEL_TOKEN       access token (Account Settings -> Tokens) scoped to the team
 *   VERCEL_PROJECT_ID  the Bublr project's ID (Project -> Settings -> General)
 *   VERCEL_TEAM_ID     the team's ID, when the project belongs to a team
 *
 * Every call resolves to { ok, status, data } and never throws, so callers
 * can tell "already attached" (400) from "attached to another project" (409).
 */

const API = 'https://api.vercel.com'
const REQUEST_TIMEOUT_MS = 15000

export function vercelConfig() {
  return {
    token: process.env.VERCEL_TOKEN || '',
    projectId: process.env.VERCEL_PROJECT_ID || '',
    teamId: process.env.VERCEL_TEAM_ID || '',
  }
}

export function isVercelConfigured() {
  const { token, projectId } = vercelConfig()
  return Boolean(token && projectId)
}

async function vercelFetch(method, path, { body, query = {} } = {}) {
  const { token, teamId } = vercelConfig()
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value)
  }
  if (teamId) params.set('teamId', teamId)
  const qs = params.toString()

  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null
  try {
    const res = await fetch(`${API}${path}${qs ? `?${qs}` : ''}`, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    })
    const text = await res.text()
    let data = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (_) {
        data = { raw: text }
      }
    }
    return { ok: res.ok, status: res.status, data }
  } catch (error) {
    return { ok: false, status: 0, data: { error: { message: error.message } } }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const enc = encodeURIComponent
const projectPath = () => `/projects/${enc(vercelConfig().projectId)}`

/** Attach a domain to the project, optionally as a redirect to another of its domains. */
export function addProjectDomain(name, { redirect = null, redirectStatusCode = 308 } = {}) {
  const body = { name }
  if (redirect) {
    body.redirect = redirect
    body.redirectStatusCode = redirectStatusCode
  }
  return vercelFetch('POST', `/v10${projectPath()}/domains`, { body })
}

export function getProjectDomain(name) {
  return vercelFetch('GET', `/v9${projectPath()}/domains/${enc(name)}`)
}

/** Ask Vercel to re-check the ownership TXT record now. 400 = not there yet. */
export function verifyProjectDomain(name) {
  return vercelFetch('POST', `/v9${projectPath()}/domains/${enc(name)}/verify`)
}

export function removeProjectDomain(name) {
  return vercelFetch('DELETE', `/v9${projectPath()}/domains/${enc(name)}`)
}

/** DNS status plus the records Vercel recommends for this project. */
export function getDomainConfig(name) {
  return vercelFetch('GET', `/v6/domains/${enc(name)}/config`, {
    query: { projectIdOrName: vercelConfig().projectId },
  })
}

export function vercelErrorMessage(result) {
  const err = result?.data?.error
  return (typeof err === 'string' ? err : err?.message) || (result?.status ? `HTTP ${result.status}` : 'network error')
}
