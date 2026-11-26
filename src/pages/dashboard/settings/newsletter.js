/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

import { authedFetch } from '../../../lib/authed-fetch'
import { hasActiveShopAccess } from '../../../lib/subscription'
import { CURRENCIES, PROVIDERS, centsToInput, formatPrice, parsePriceInput } from '../../../lib/shop'
import { DsSection, DsTray, DsTile } from '../../../components/dashboard/ds-section'
import { DsInput, DsTextarea, DsLabel, DsField } from '../../../components/dashboard/ds-input'
import DsButton from '../../../components/dashboard/ds-button'
import DsSwitch from '../../../components/dashboard/ds-switch'
import { PaymentsPanel, PlanGate, noticeStyle } from '../../../components/dashboard/payments-panel'
import { BlockSettingsPage, LoadingContainer, helpText, useCurrentUserDoc, withBlockLayout } from '../../../components/dashboard/block-editor-kit'

// Display only: the server checks the signed plan grant itself.
const planIsOn = user => hasActiveShopAccess(user) && Boolean(user.shopGrant)

const BULLETS = [
  'A paid newsletter: readers subscribe monthly or yearly',
  'Posts just for paid subscribers, with a free preview for everyone else',
  'Subscribers pay you directly, through your own Stripe or Creem; Bublr takes no cut',
  'Everything in Pro (custom domain, your own footer) and a shop',
]

const selectStyle = css`
  font: inherit;
  font-size: 0.85rem;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--grey-1);
  color: var(--grey-4);
`

function useSummary() {
  const [summary, setSummary] = useState(null)
  const reload = useCallback(async () => {
    const response = await authedFetch('/api/newsletter/paid/settings')
    const data = await response.json().catch(() => ({}))
    setSummary(response.ok ? data : { error: data.error || 'Couldn’t load your settings' })
    return data
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return [summary, reload, setSummary]
}

function PriceForm({ summary, provider, onSaved }) {
  const saved = summary.settings
  const currencies = provider ? PROVIDERS[provider].currencies : Object.keys(CURRENCIES)
  const [enabled, setEnabled] = useState(saved ? saved.enabled : true)
  const [currency, setCurrency] = useState(saved?.currency && currencies.includes(saved.currency) ? saved.currency : currencies[0])
  const [monthly, setMonthly] = useState(saved?.monthly ? centsToInput(saved.monthly) : '5')
  const [yearly, setYearly] = useState(saved?.yearly ? centsToInput(saved.yearly) : '')
  const [description, setDescription] = useState(saved?.description || '')
  const [teaseFree, setTeaseFree] = useState(saved ? saved.teaseFree : true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const monthlyCents = parsePriceInput(monthly)
      const yearlyCents = yearly.trim() ? parsePriceInput(yearly) : null
      const response = await authedFetch('/api/newsletter/paid/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, currency, monthly: monthlyCents, yearly: yearlyCents, description, teaseFree }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Couldn’t save')
      onSaved(data)
      setMessage({
        type: 'success',
        text: enabled ? 'Saved. Readers can now subscribe from your page and your paid posts.' : 'Saved. New readers can’t subscribe for now; current paid subscribers keep what they pay for.',
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div css={css`display: flex; flex-direction: column; gap: 1rem; max-width: 520px;`}>
      <DsTile css={css`display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;`}>
        <div>
          <p css={css`font-size: 0.85rem; font-weight: 500; color: var(--grey-5); margin: 0;`}>Take new paid subscribers</p>
          <p css={[helpText, css`margin: 0.15rem 0 0;`]}>Turn off to pause sign-ups. People already paying keep their subscription.</p>
        </div>
        <DsSwitch checked={enabled} onChange={setEnabled} aria-label="Take new paid subscribers" />
      </DsTile>
      <div css={css`display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));`}>
        <DsField css={css`margin: 0;`}>
          <DsLabel htmlFor="paid-monthly">Monthly price</DsLabel>
          <DsInput id="paid-monthly" inputMode="decimal" value={monthly} onChange={event => setMonthly(event.target.value)} placeholder="5" />
        </DsField>
        <DsField css={css`margin: 0;`}>
          <DsLabel htmlFor="paid-yearly" hint="optional">Yearly price</DsLabel>
          <DsInput id="paid-yearly" inputMode="decimal" value={yearly} onChange={event => setYearly(event.target.value)} placeholder="50" />
        </DsField>
        <DsField css={css`margin: 0;`}>
          <DsLabel htmlFor="paid-currency">Currency</DsLabel>
          <select id="paid-currency" css={selectStyle} value={currency} onChange={event => setCurrency(event.target.value)}>
            {currencies.map(code => (
              <option key={code} value={code}>{CURRENCIES[code]?.label || code.toUpperCase()}</option>
            ))}
          </select>
        </DsField>
      </div>
      <DsField css={css`margin: 0;`}>
        <DsLabel htmlFor="paid-description" hint="shown where readers subscribe">What paid subscribers get</DsLabel>
        <DsTextarea
          id="paid-description"
          rows={3}
          maxLength={280}
          value={description}
          onChange={event => setDescription(event.target.value)}
          placeholder="A long essay every month, and the back catalogue."
        />
      </DsField>
      <DsTile css={css`display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;`}>
        <div>
          <p css={css`font-size: 0.85rem; font-weight: 500; color: var(--grey-5); margin: 0;`}>Preview paid posts to free subscribers</p>
          <p css={[helpText, css`margin: 0.15rem 0 0;`]}>They get the free part and an invitation to subscribe. Off: paid posts are emailed to paid subscribers only.</p>
        </div>
        <DsSwitch checked={teaseFree} onChange={setTeaseFree} aria-label="Preview paid posts to free subscribers" />
      </DsTile>
      <div css={css`display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;`}>
        <DsButton variant="accent" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</DsButton>
        <span css={helpText}>Price changes apply to new subscribers; people already paying keep their price.</span>
      </div>
      {message ? <p role="status" css={noticeStyle(message.type)}>{message.text}</p> : null}
    </div>
  )
}

function PaidSubscribersPanel({ summary, reload, provider }) {
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)
  const counts = summary.counts || { paying: 0, renewing: 0, total: 0 }
  const providerName = PROVIDERS[provider]?.name || 'your payment provider'

  const act = async (action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(action)
    setMessage(null)
    try {
      const response = await authedFetch('/api/newsletter/paid/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok && response.status !== 207) throw new Error(data.error || 'Something went wrong')
      await reload()
      if (action === 'refresh') setMessage({ type: 'success', text: `Checked ${data.checked} subscription${data.checked === 1 ? '' : 's'} with ${providerName}.` })
      else if (data.failed) setMessage({ type: 'error', text: `${data.cancelled} cancelled; ${data.failed} couldn’t be reached. Try again, or cancel them in ${providerName}.` })
      else setMessage({ type: 'success', text: `Done. ${data.cancelled} subscription${data.cancelled === 1 ? '' : 's'} won’t renew; each ends when its paid period does.` })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div css={css`display: flex; flex-direction: column; gap: 0.9rem;`}>
      <p css={[helpText, css`font-size: 0.85rem;`]}>
        <strong css={css`color: var(--grey-5); font-weight: 500;`}>{counts.paying}</strong> paying now
        {counts.renewing !== counts.paying ? `, ${counts.renewing} renewing` : ''}. See everyone on the{' '}
        <Link href="/dashboard/subscribers"><a>Subscribers</a></Link> page.
      </p>
      <div css={css`display: flex; gap: 0.5rem; flex-wrap: wrap;`}>
        <DsButton size="sm" variant="outline" disabled={Boolean(busy) || !counts.total} onClick={() => act('refresh')}>
          {busy === 'refresh' ? 'Checking…' : `Check with ${providerName}`}
        </DsButton>
        <DsButton
          size="sm"
          variant="outline"
          disabled={Boolean(busy) || !counts.renewing}
          onClick={() =>
            act(
              'cancel-all',
              `Stop all ${counts.renewing} paid subscription${counts.renewing === 1 ? '' : 's'} from renewing? Each subscriber keeps access until the end of the period they paid for, and isn’t charged again. This can’t be undone from here.`
            )
          }
        >
          {busy === 'cancel-all' ? 'Ending…' : 'End all paid subscriptions'}
        </DsButton>
      </div>
      <p css={helpText}>Ending all paid subscriptions is what to do before you stop writing for paid subscribers or delete your account. Refunds, if you want to give them, are made in {providerName}.</p>
      {message ? <p role="status" css={noticeStyle(message.type)}>{message.text}</p> : null}
    </div>
  )
}

function NewsletterEditor({ user, authUser }) {
  const [summary, reload, setSummary] = useSummary()
  const [payments, setPayments] = useState(null)

  if (!summary) return <p css={helpText}>Loading…</p>
  if (summary.error) return <p css={noticeStyle('error')}>{summary.error}</p>

  const counts = summary.counts || { paying: 0, renewing: 0, total: 0 }
  const provider = payments?.provider || summary.payments?.provider || null

  if (!planIsOn(user)) {
    return (
      <>
        <PlanGate
          user={user}
          authUser={authUser}
          title="Paid newsletter"
          description="Let readers pay for your writing. They pay you directly; Bublr takes no cut."
          bullets={BULLETS}
          upgradingText="Switching your plan… paid subscriptions open here as soon as Creem confirms the payment."
          paidText="Thanks! Your payment went through. Opening your paid newsletter… this page updates by itself in a few seconds."
        />
        {counts.total ? (
          <DsSection title="Paid subscribers" description="Your plan has ended, so nobody new can subscribe and you can’t publish new paid posts. Readers who already pay can still read your paid posts until they stop paying.">
            <PaidSubscribersPanel summary={summary} reload={reload} provider={provider} />
          </DsSection>
        ) : null}
      </>
    )
  }

  return (
    <>
      <DsSection title="Paid newsletter" description="Readers subscribe from your page, the end of your posts and your paid posts’ paywall. Everyone gets your free posts; paid subscribers get every post.">
        {summary.open ? (
          <p css={noticeStyle('success')}>
            Readers can subscribe{summary.settings ? ` for ${formatPrice(summary.settings.monthly, summary.settings.currency)} a month${summary.settings.yearly ? ` or ${formatPrice(summary.settings.yearly, summary.settings.currency)} a year` : ''}` : ''}.{' '}
            {summary.payments?.mode === 'test' ? 'Test mode: only you can subscribe, with a test card.' : 'In the editor, set a post’s Who can read to Paid subscribers.'}
          </p>
        ) : (
          <p css={noticeStyle('info')}>
            {!summary.payments ? 'Connect your Stripe or Creem account below, then set your prices.' : summary.settings?.enabled === false ? 'New paid sign-ups are paused.' : 'Set your prices below to open paid subscriptions.'}
          </p>
        )}
      </DsSection>
      <DsSection title="Payments" description="Your own payment account. Every subscription is paid straight into it.">
        <PaymentsPanel onChange={setPayments} purpose="newsletter" paidSubscribers={counts.renewing} />
      </DsSection>
      {summary.payments || payments ? (
        <DsSection title="Prices">
          <PriceForm summary={summary} provider={provider} onSaved={setSummary} />
        </DsSection>
      ) : null}
      <DsSection title="Paid subscribers">
        <PaidSubscribersPanel summary={summary} reload={reload} provider={provider} />
      </DsSection>
      <DsSection title="How it works">
        <DsTray>
          <DsTile>
            <ul css={[helpText, css`margin: 0; padding-left: 1.1rem; li + li { margin-top: 0.4rem; }`]}>
              <li>In the editor, choose <strong>Who can read → Paid subscribers</strong>. Type <code>/paywall</code> to decide where the free preview ends; without a line, only the title and excerpt are free.</li>
              <li>A paid post’s full text is stored encrypted. Feeds, search, the fediverse and free subscribers get the preview and a link.</li>
              <li>Paid subscribers get every post by email. On the web they sign in with a link from any of those emails, or ask for one on the post.</li>
              <li>Each email has a link where subscribers can cancel or change their card. Unsubscribing cancels their payment too.</li>
              <li>Statuses come from {PROVIDERS[provider]?.name || 'your payment provider'}: renewals, failed payments and cancellations are checked when a period ends.</li>
            </ul>
          </DsTile>
        </DsTray>
      </DsSection>
    </>
  )
}

function NewsletterSettings() {
  const { user, authUser, loading } = useCurrentUserDoc()
  return (
    <BlockSettingsPage title="Newsletter">
      <LoadingContainer isLoading={loading || !user}>
        {user ? <NewsletterEditor key={planIsOn(user) ? 'on' : 'off'} user={user} authUser={authUser} /> : null}
      </LoadingContainer>
    </BlockSettingsPage>
  )
}

export default withBlockLayout(NewsletterSettings, 'Newsletter')
