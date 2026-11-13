/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { css } from '@emotion/react'
import { CheckIcon } from '@radix-ui/react-icons'

import { PLANS, PLAN_INTERVALS, planPriceLabel } from '../../lib/plans'
import DsButton from './ds-button'
import { DsInput, DsLabel } from './ds-input'
import { DsTray, DsTile } from './ds-section'
import PlanPicker from './plan-picker'

const titleStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--grey-5);
  margin: 0;
`

const hintStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.72rem;
  color: var(--grey-3);
  margin: 0.15rem 0 0 0;
  line-height: 1.45;
`

const featureListStyle = css`
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1rem;
  margin: 0.65rem 0 0 0;
  padding: 0;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--grey-4);

  li {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  svg {
    flex-shrink: 0;
    color: var(--accent-foreground);
  }
`

const actionRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
`

const summaryRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`

const statusDotStyle = css`
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 3px var(--green-soft);
`

const statusDotEndingStyle = css`
  background: var(--grey-3);
  box-shadow: 0 0 0 3px var(--accent-bg-strong);
`

const FEATURES = ['Your own domain', 'Your own footer text', 'Your own newsletter email']

const isEmail = value => typeof value === 'string' && /^\S+@\S+\.\S+$/.test(value.trim())

function formatDate(ms) {
  if (typeof ms !== 'number') return ''
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * The offer shown in Settings → Advanced → Custom domain to a writer without
 * the add-on: what they get, the monthly / yearly choice, and the button that
 * starts Polar's checkout.
 *
 * Props:
 *   availablePlans — intervals this deployment can sell (from /api/subscription/status)
 *   needsEmail     — true when the sign-in has no email to bill
 *   email, onEmailChange
 *   onSubscribe    — (interval) => void
 *   busy           — a checkout is being created
 */
export function CustomDomainUpgrade({
  availablePlans,
  needsEmail = false,
  email = '',
  onEmailChange,
  onSubscribe,
  busy = false,
}) {
  // Nothing configured (local development): show both so the page looks right;
  // the checkout route explains itself if someone presses the button.
  const offered = availablePlans?.length
    ? PLAN_INTERVALS.filter(interval => availablePlans.includes(interval))
    : PLAN_INTERVALS

  // Yearly is the better price, so it's the starting choice when it's on offer
  const [choice, setChoice] = useState(null)
  const interval = offered.includes(choice) ? choice : offered.includes('year') ? 'year' : offered[0]

  const canSubscribe = !busy && (!needsEmail || isEmail(email))

  return (
    <DsTray css={css`margin-bottom: 1rem;`}>
      <DsTile>
        <p css={titleStyle}>Use your own domain</p>
        <p css={hintStyle}>
          Put your Bublr page on a domain you own, like blog.yoursite.com, and swap the
          &quot;Made with Bublr&quot; footer for your own words.
        </p>
        <ul css={featureListStyle}>
          {FEATURES.map(feature => (
            <li key={feature}>
              <CheckIcon width={13} height={13} aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
      </DsTile>

      <PlanPicker intervals={offered} value={interval} onChange={setChoice} disabled={busy} />

      <DsTile>
        {needsEmail && (
          <div css={css`margin-bottom: 0.85rem;`}>
            <DsLabel htmlFor="billing-email">Email for billing</DsLabel>
            <DsInput
              id="billing-email"
              type="email"
              value={email}
              onChange={e => onEmailChange?.(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
            />
          </div>
        )}
        <div css={actionRowStyle}>
          <p css={[hintStyle, css`margin: 0;`]}>
            Cancel any time. Checkout is handled by Polar.
          </p>
          <DsButton onClick={() => onSubscribe?.(interval)} disabled={!canSubscribe} aria-live="polite">
            {busy ? 'Opening checkout…' : `Subscribe — ${planPriceLabel(interval)}`}
          </DsButton>
        </div>
      </DsTile>
    </DsTray>
  )
}

/**
 * The row a subscribed writer sees: which plan they're on, when it renews (or
 * ends, if they've cancelled) and the way into Polar's billing portal.
 *
 * `subscription` is the serialized one from /api/subscription/status: dates
 * are milliseconds, `interval` is 'month' | 'year' | null (null for
 * subscriptions older than the yearly plan, until Polar next updates them).
 */
export function SubscriptionSummary({ subscription, onManageBilling, busy = false }) {
  const plan = PLANS[subscription?.interval]
  const ending = !!subscription?.cancelAtPeriodEnd
  const date = formatDate(subscription?.currentPeriodEnd)

  const title = plan ? `${plan.label} plan` : 'Subscription is active'
  const details = [
    plan && planPriceLabel(plan.interval),
    date && (ending ? `Ends on ${date}` : `Renews on ${date}`),
  ].filter(Boolean)

  return (
    <DsTray>
      <DsTile>
        <div css={summaryRowStyle}>
          <div css={css`display: flex; align-items: center; gap: 0.7rem; min-width: 0;`}>
            <span css={[statusDotStyle, ending && statusDotEndingStyle]} aria-hidden="true" />
            <div css={css`min-width: 0;`}>
              <p css={titleStyle}>{title}</p>
              {details.length > 0 && <p css={hintStyle}>{details.join(' · ')}</p>}
            </div>
          </div>
          <DsButton variant="outline" size="sm" onClick={onManageBilling} disabled={busy}>
            Manage Billing
          </DsButton>
        </div>
        {ending && (
          <p css={[hintStyle, css`margin-top: 0.6rem;`]}>
            You&apos;ve cancelled. Your domain and footer keep working until then, and your
            settings are kept if you come back.
          </p>
        )}
      </DsTile>
    </DsTray>
  )
}
