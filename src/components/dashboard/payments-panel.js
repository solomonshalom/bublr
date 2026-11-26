/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import { authedFetch } from '../../lib/authed-fetch'
import { hasActiveAccess } from '../../lib/subscription'
import { PROVIDERS } from '../../lib/shop'
import { DsSection, DsTray, DsTile } from './ds-section'
import { DsInput } from './ds-input'
import DsButton from './ds-button'
import { helpText } from './block-editor-kit'

/**
 * Shared by Settings → Shop and Settings → Newsletter: the Pro + Shop plan
 * card, and the writer's own payment account (Stripe or Creem). Shop sales
 * and paid newsletter subscriptions both go straight to that account.
 */

export const noticeStyle = type => css`
  font-size: 0.8rem;
  line-height: 1.5;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  border: 1px solid ${type === 'error' ? 'rgba(220,38,38,0.3)' : type === 'success' ? 'var(--green-border)' : 'var(--border)'};
  background: ${type === 'error' ? 'rgba(220,38,38,0.08)' : type === 'success' ? 'var(--green-soft)' : 'var(--accent-bg)'};
  color: var(--grey-4);
`

export const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const DEFAULT_BULLETS = [
  'Everything in Pro: custom domain and your own footer',
  'A shop on your profile, with product pages and checkout',
  'A paid newsletter: readers subscribe monthly or yearly',
  'Bublr takes no cut of sales or subscriptions',
  'Buyers and subscribers pay you directly, through your own Stripe or Creem',
]

/** The Pro + Shop plan: start it, or add it to a renewing Pro plan. */
export function PlanGate({
  user,
  authUser,
  title = 'Shop',
  description = 'Sell what you make, right from your profile.',
  bullets = DEFAULT_BULLETS,
  upgradingText = 'Switching your plan… your shop opens here as soon as Creem confirms the payment.',
  paidText = 'Thanks! Your payment went through. Opening your shop… this page updates by itself in a few seconds.',
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [upgrading, setUpgrading] = useState(false)
  const waiting = router.query.subscription === 'success' || upgrading
  const onPro = hasActiveAccess(user)
  const renewing = onPro && user.subscription?.id && ['active', 'trialing'].includes(user.subscription.status) && !user.subscription.cancelAtPeriodEnd

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      if (renewing) {
        const response = await authedFetch('/api/subscription/upgrade', { method: 'POST' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not change your plan')
        setUpgrading(true)
        return
      }
      const response = await authedFetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userEmail: user.email || authUser?.email, userName: user.name, plan: 'shop' }),
      })
      const data = await response.json()
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || 'Could not start checkout')
      window.location.assign(data.checkoutUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DsSection title={title} description={description}>
      <DsTray>
        <DsTile>
          <div css={css`display: flex; flex-direction: column; gap: 0.9rem;`}>
            <div css={css`display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap;`}>
              <span css={css`font-size: 1rem; font-weight: 500; color: var(--grey-5);`}>Pro + Shop</span>
              <span css={css`font-size: 0.85rem; color: var(--grey-3);`}>
                <strong css={css`font-size: 1.1rem; font-weight: 500; color: var(--grey-5);`}>$3</strong> / month
              </span>
            </div>
            <ul css={css`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.82rem; color: var(--grey-4); li { display: flex; gap: 0.5rem; align-items: center; } svg { color: var(--green); flex-shrink: 0; }`}>
              {bullets.map(text => (
                <li key={text}><CheckIcon /> {text}</li>
              ))}
            </ul>
            {waiting ? (
              <p css={noticeStyle('info')}>{upgrading ? upgradingText : paidText}</p>
            ) : (
              <div css={css`display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;`}>
                <DsButton variant="accent" disabled={busy} onClick={start}>
                  {busy ? 'One moment…' : renewing ? 'Move to Pro + Shop (+$1/month)' : 'Start Pro + Shop'}
                </DsButton>
                <span css={helpText}>
                  {renewing ? 'Your Pro plan moves to Pro + Shop; you’re charged the difference for this month.' : 'Cancel any time.'}
                </span>
              </div>
            )}
            {error ? <p css={noticeStyle('error')}>{error}</p> : null}
            {onPro && !renewing ? (
              <p css={helpText}>Your Pro plan is set to end, so it can’t be changed. Start Pro + Shop once it ends, or turn renewal back on from the billing portal in Advanced settings.</p>
            ) : null}
          </div>
        </DsTile>
      </DsTray>
    </DsSection>
  )
}

/** Connect, change or disconnect the writer's own Stripe or Creem account. */
export function PaymentsPanel({ onChange, purpose = 'shop', paidSubscribers = 0 }) {
  const [payments, setPayments] = useState(undefined)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    const response = await authedFetch('/api/shop/payments')
    const data = await response.json().catch(() => ({}))
    setPayments(response.ok ? data.payments || null : null)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    onChange?.(payments)
  }, [payments, onChange])

  const connect = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const response = await authedFetch('/api/shop/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not connect')
      setPayments(data.payments)
      setApiKey('')
      setEditing(false)
      setMessage({ type: 'success', text: `${PROVIDERS[data.payments.provider].name} is connected. ${purpose === 'newsletter' ? 'Subscribers' : 'Buyers'} now pay you directly.` })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (
      paidSubscribers > 0 &&
      !window.confirm(
        `${paidSubscribers} paid ${paidSubscribers === 1 ? 'subscriber is' : 'subscribers are'} billed through this account. If you disconnect it, Bublr can’t check or cancel their subscriptions (they keep being charged until you cancel them in your payment dashboard). Disconnect anyway?`
      )
    ) {
      return
    }
    setBusy(true)
    await authedFetch('/api/shop/payments', { method: 'DELETE' })
    setPayments(null)
    setBusy(false)
    setMessage({ type: 'info', text: 'Payments are disconnected. Your shop and paid subscriptions show “Not available yet” until you connect again.' })
  }

  if (payments === undefined) return <p css={helpText}>Loading…</p>

  return (
    <div css={css`display: flex; flex-direction: column; gap: 0.9rem;`}>
      {message ? <p role="status" css={noticeStyle(message.type)}>{message.text}</p> : null}
      {payments && !editing ? (
        <DsTile>
          <div css={css`display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;`}>
            <div css={css`flex: 1; min-width: 180px; font-size: 0.85rem; color: var(--grey-4); line-height: 1.5;`}>
              <strong css={css`font-weight: 500;`}>{PROVIDERS[payments.provider]?.name}</strong>
              {payments.accountName ? ` · ${payments.accountName}` : ''}
              <div css={css`font-size: 0.75rem; color: var(--grey-3);`}>
                <code>{payments.keyHint}</code>
                {payments.mode === 'test' ? ' · Test mode: no real money moves' : ''}
              </div>
            </div>
            <DsButton size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>Change</DsButton>
            <DsButton size="sm" variant="outline" disabled={busy} onClick={disconnect}>Disconnect</DsButton>
          </div>
        </DsTile>
      ) : (
        <>
          <div css={[helpText, css`display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));`]}>
            <div>
              <strong css={css`color: var(--grey-4); font-weight: 500;`}>Stripe</strong> (anything, including things you ship). In Stripe, open <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer">Developers → API keys</a>, create a <strong>restricted key</strong> with <strong>Checkout Sessions: Write</strong> and, for a paid newsletter, <strong>Subscriptions: Write</strong> (add <strong>Customer portal: Write</strong> to let subscribers change their card), and paste it here (<code>rk_live_…</code>). Your secret key isn’t accepted: it can do much more than Bublr needs.
            </div>
            <div>
              <strong css={css`color: var(--grey-4); font-weight: 500;`}>Creem</strong> (digital things and newsletters, in USD or EUR; Creem handles sales tax for you). In Creem, open <a href="https://www.creem.io/dashboard/developers" target="_blank" rel="noreferrer">Developers → API keys</a>, create a key with <strong>Products</strong>, <strong>Checkouts</strong>, <strong>Subscriptions</strong> and <strong>Customers</strong> read/write, and paste it here (<code>creem_…</code>).
            </div>
          </div>
          <div css={css`display: flex; gap: 0.5rem; flex-wrap: wrap;`}>
            <DsInput
              type="password"
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder="Paste your Stripe or Creem API key"
              autoComplete="off"
              spellCheck={false}
              aria-label="Payment API key"
              css={css`flex: 1; min-width: 240px;`}
            />
            <DsButton variant="accent" disabled={busy || apiKey.trim().length < 12} onClick={connect}>
              {busy ? 'Checking…' : 'Connect'}
            </DsButton>
            {editing ? <DsButton variant="ghost" onClick={() => setEditing(false)}>Cancel</DsButton> : null}
          </div>
          <p css={helpText}>The key is checked with Stripe/Creem, then stored encrypted. Bublr only uses it to open checkouts, confirm they were paid and, for paid subscribers, check, cancel or resume their subscriptions. A test key works for trying things out: while it’s connected, only you can buy or subscribe.</p>
        </>
      )}
    </div>
  )
}
