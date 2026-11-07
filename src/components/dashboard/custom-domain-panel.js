/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

import { authedFetch } from '../../lib/authed-fetch'
import { parseDomainInput, isSubdomain, companionDomain } from '../../lib/domain-utils'
import { PRO_PLAN } from '../../lib/pricing'
import DsButton from './ds-button'
import { DsInput } from './ds-input'
import { DsSection } from './ds-section'
import Spinner from '../spinner'
import { NewsletterTemplateSection } from '../profile-settings-modal'
import {
  proSurface,
  proButton,
  proGhostButton,
  DomainMorph,
  SparkleIcon,
} from '../pro/pro-look'

const PAGE = '/dashboard/settings/domain'
const RECHECK_EVERY_MS = 30 * 1000
const RECHECK_MAX = 40 // ~20 minutes of automatic checks per visit
const CONFIRM_FOR_MS = 90 * 1000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function formatDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(value) {
  const ms = Date.now() - new Date(value).getTime()
  if (!value || Number.isNaN(ms)) return null
  if (ms < 45 * 1000) return 'just now'
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return formatDate(value)
}

async function readJson(res) {
  try {
    return await res.json()
  } catch (_) {
    return {}
  }
}

// ---------- small pieces ----------

const bannerTones = {
  info: css`
    background: var(--accent-soft);
    border-color: var(--accent-border);
    color: var(--grey-4);
  `,
  success: css`
    background: var(--green-soft);
    border-color: rgba(48, 164, 108, 0.4);
    color: var(--grey-4);
  `,
  error: css`
    background: rgba(229, 72, 77, 0.08);
    border-color: rgba(229, 72, 77, 0.45);
    color: var(--grey-4);
  `,
  warning: css`
    background: rgba(234, 88, 12, 0.08);
    border-color: rgba(234, 88, 12, 0.4);
    color: var(--grey-4);
  `,
}

function Banner({ tone = 'info', children, action }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      css={[
        css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding: 0.7rem 0.85rem;
          margin-bottom: 1.25rem;
          border: 1px solid;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 0.82rem;
          line-height: 1.5;
        `,
        bannerTones[tone],
      ]}
    >
      <div css={css`flex: 1; min-width: 12rem;`}>{children}</div>
      {action}
    </div>
  )
}

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(234, 140, 30, 0.5); }
  70% { box-shadow: 0 0 0 6px rgba(234, 140, 30, 0); }
  100% { box-shadow: 0 0 0 0 rgba(234, 140, 30, 0); }
`

function StatusDot({ live }) {
  return (
    <span
      css={css`
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 500;
        white-space: nowrap;
        color: ${live ? 'var(--green)' : '#c2410c'};
        background: ${live ? 'var(--green-soft)' : 'rgba(234, 140, 30, 0.12)'};

        [data-theme='dark'] & {
          color: ${live ? 'var(--green)' : '#fdba74'};
        }

        &::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          ${live ? '' : css`animation: ${pulse} 1.8s ease-out infinite;`}
        }
      `}
    >
      {live ? 'Live' : 'Waiting for DNS'}
    </span>
  )
}

function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch (_) {
      // Older browsers / insecure contexts
      const area = document.createElement('textarea')
      area.value = value
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label} ${value}`}
      css={css`
        flex-shrink: 0;
        padding: 0.2rem 0.45rem;
        border-radius: 5px;
        border: 1px solid var(--border);
        background: var(--grey-1);
        color: ${copied ? 'var(--green)' : 'var(--grey-3)'};
        font-family: 'Inter', sans-serif;
        font-size: 0.68rem;
        cursor: pointer;

        &:hover {
          color: var(--grey-4);
          border-color: var(--grey-3);
        }
      `}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

const monoStyle = css`
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  color: var(--grey-4);
  word-break: break-all;
`

function DnsRecords({ records }) {
  if (!records?.length) return null
  return (
    <div
      css={css`
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
        background: var(--grey-1);
      `}
    >
      <div
        css={css`
          display: grid;
          grid-template-columns: 5rem 9rem 1fr;
          gap: 0.75rem;
          padding: 0.5rem 0.85rem;
          background: var(--accent-bg-strong);
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--grey-3);

          @media (max-width: 640px) {
            display: none;
          }
        `}
      >
        <span>Type</span>
        <span>Name</span>
        <span>Value</span>
      </div>
      {records.map((record, index) => (
        <div
          key={`${record.type}-${record.host}-${index}`}
          css={css`
            display: grid;
            grid-template-columns: 5rem 9rem 1fr;
            gap: 0.75rem;
            align-items: center;
            padding: 0.7rem 0.85rem;
            border-top: 1px solid var(--border);

            &:first-of-type {
              border-top: none;
            }

            @media (max-width: 640px) {
              grid-template-columns: 1fr;
              gap: 0.35rem;
            }
          `}
        >
          <div css={css`display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;`}>
            <strong css={css`font-size: 0.8rem; color: var(--grey-5);`}>{record.type}</strong>
            {!record.required && (
              <span css={css`font-size: 0.65rem; color: var(--grey-3);`}>optional</span>
            )}
          </div>
          <div css={css`display: flex; align-items: center; gap: 0.4rem; min-width: 0;`}>
            <span css={monoStyle}>{record.name}</span>
            <CopyButton value={record.name} label="Copy name" />
          </div>
          <div css={css`display: flex; align-items: center; gap: 0.4rem; min-width: 0;`}>
            <span css={monoStyle}>{record.value}</span>
            <CopyButton value={record.value} label="Copy value" />
          </div>
          {record.purpose !== 'routing' && (
            <p css={css`grid-column: 1 / -1; margin: 0; font-size: 0.72rem; color: var(--grey-3);`}>
              {record.purpose === 'ownership'
                ? 'Proves the domain is yours. You can delete it once your domain is live.'
                : `So ${record.host} also works. It forwards readers to your main address.`}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function DnsTips({ records }) {
  const routing = records?.find(r => r.purpose === 'routing')
  return (
    <details
      css={css`
        margin-top: 0.85rem;
        font-size: 0.78rem;
        color: var(--grey-3);
        line-height: 1.6;

        summary {
          cursor: pointer;
          color: var(--grey-4);
          font-weight: 500;
        }

        ul {
          margin: 0.5rem 0 0 1.1rem;
        }

        li {
          margin: 0.25rem 0;
        }
      `}
    >
      <summary>Stuck? Tips for common DNS providers</summary>
      <ul>
        <li>
          <strong>Cloudflare:</strong> set the record to <em>DNS only</em> (grey cloud), not <em>Proxied</em>.
        </li>
        {routing && routing.name !== '@' && (
          <li>
            Some providers want the full name: try <code>{routing.host}</code> instead of <code>{routing.name}</code>.
          </li>
        )}
        {routing && routing.name === '@' && (
          <li>
            No <code>@</code> option? Leave the name blank, or enter <code>{routing.host}</code>.
          </li>
        )}
        <li>Delete any other A, AAAA or CNAME records on the same name — they send readers somewhere else.</li>
        <li>
          Using CAA records? Add one for <code>letsencrypt.org</code> so your HTTPS certificate can be issued.
        </li>
        <li>Changes usually show up within minutes. Occasionally DNS takes up to 48 hours.</li>
      </ul>
    </details>
  )
}

// ---------- the pitch (no Pro yet) ----------

const heroStyle = css`
  border-radius: 14px;
  padding: 1.6rem 1.5rem 1.5rem;
  margin-bottom: 1.75rem;
  box-shadow: 0 18px 40px -24px rgba(140, 45, 0, 0.8);

  @media (max-width: 520px) {
    padding: 1.25rem 1.1rem;
  }
`

const featureListStyle = css`
  list-style: none;
  margin: 1.1rem 0 1.25rem;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem 1.25rem;
  font-size: 0.82rem;
  line-height: 1.4;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }

  li {
    display: flex;
    gap: 0.45rem;
  }

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
  }
`

const Check = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

function ProPitch({ username, status, onSubscribe, busy }) {
  const billingReady = status?.billingConfigured !== false
  return (
    <div css={[proSurface, heroStyle]}>
      <p
        css={css`
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin: 0 0 0.6rem;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          opacity: 0.92;
        `}
      >
        <SparkleIcon size={11} /> {PRO_PLAN.name}
      </p>
      <h2 css={css`margin: 0 0 0.5rem; font-size: 1.45rem; line-height: 1.25; font-weight: 600; color: #fff; letter-spacing: -0.01em;`}>
        Put your writing on your own domain.
      </h2>
      <p css={css`margin: 0 0 1rem; font-size: 0.88rem; line-height: 1.55; opacity: 0.92; max-width: 34rem;`}>
        Readers find you at your own address instead of a bublr.life link. Same posts, same newsletter, same everything —
        just yours.
      </p>

      <DomainMorph username={username} />

      <ul css={featureListStyle}>
        {PRO_PLAN.features.map(feature => (
          <li key={feature}>
            <Check /> {feature}
          </li>
        ))}
      </ul>

      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding-top: 1.1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.25);
        `}
      >
        <div>
          <div css={css`display: flex; align-items: baseline; gap: 0.3rem;`}>
            <span css={css`font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1;`}>{PRO_PLAN.price}</span>
            <span css={css`font-size: 0.85rem; opacity: 0.9;`}>/ month</span>
          </div>
          <p css={css`margin: 0.3rem 0 0; font-size: 0.74rem; opacity: 0.85;`}>Cancel anytime. Your domain works until the end of the month you paid for.</p>
        </div>
        <button type="button" css={proButton} onClick={onSubscribe} disabled={busy || !billingReady}>
          {busy ? 'Opening checkout…' : `Get ${PRO_PLAN.name} — ${PRO_PLAN.shortPriceLabel}`}
        </button>
      </div>
      <p css={css`margin: 0.85rem 0 0; font-size: 0.7rem; opacity: 0.8;`}>
        {billingReady
          ? 'Secure checkout by Dodo Payments. Prices in USD; local taxes may be added at checkout.'
          : 'Checkout is being set up — check back very soon.'}
      </p>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    ['Subscribe', `${PRO_PLAN.priceLabel}, billed monthly. Cancel whenever you like.`],
    ['Add your domain', 'A root domain (yourname.com) or a subdomain (blog.yourname.com) — both work.'],
    ['Point your DNS', 'We show you the exact records to add. HTTPS is set up for you automatically.'],
  ]
  return (
    <DsSection title="How it works">
      <ol
        css={css`
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.6rem;

          @media (max-width: 760px) {
            grid-template-columns: 1fr;
          }
        `}
      >
        {steps.map(([title, text], i) => (
          <li
            key={title}
            css={css`
              background: var(--grey-1);
              border: 1px solid var(--border);
              border-radius: 8px;
              padding: 0.85rem 0.95rem;
              box-shadow: var(--chord-shadow-sm);
            `}
          >
            <span
              css={css`
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 1.35rem;
                height: 1.35rem;
                border-radius: 50%;
                margin-bottom: 0.5rem;
                font-size: 0.72rem;
                font-weight: 600;
                color: #fff;
                background: linear-gradient(315deg, #dd814c, #bc3c00);
              `}
            >
              {i + 1}
            </span>
            <p css={css`margin: 0 0 0.25rem; font-size: 0.85rem; font-weight: 500; color: var(--grey-5);`}>{title}</p>
            <p css={css`margin: 0; font-size: 0.78rem; line-height: 1.5; color: var(--grey-3);`}>{text}</p>
          </li>
        ))}
      </ol>
      <p css={css`margin: 0.9rem 0 0; font-size: 0.78rem; color: var(--grey-3); line-height: 1.55;`}>
        Don’t have a domain yet? Buy one from any registrar — Namecheap, Porkbun, Cloudflare, Google/Squarespace, GoDaddy
        — then come back here. Full guide in{' '}
        <Link href="/docs/custom-domains" passHref>
          <a css={css`color: var(--accent-foreground);`}>the docs</a>
        </Link>
        .
      </p>
    </DsSection>
  )
}

// ---------- plan strip (has Pro) ----------

function PlanStrip({ status, onPortal, onCancel, onResume, busy }) {
  const sub = status.subscription
  const state = status.state
  let line = 'Active'
  if (state === 'active' && sub?.currentPeriodEnd && sub?.provider === 'dodo') line = `Active · renews ${formatDate(sub.currentPeriodEnd)}`
  if (state === 'canceling') line = status.accessUntil ? `Cancelled · active until ${formatDate(status.accessUntil)}` : 'Cancelled'
  if (state === 'past_due') line = status.accessUntil ? `Payment failed · domain stays online until ${formatDate(status.accessUntil)}` : 'Payment failed'

  const canManage = Boolean(sub?.canManageBilling) && status.billingConfigured
  const canResume = canManage && state === 'canceling' && sub?.status === 'active' && sub?.cancelAtPeriodEnd
  const canCancel = canManage && state === 'active'

  return (
    <div
      css={[
        proSurface,
        css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.85rem;
          padding: 0.95rem 1.1rem;
          margin-bottom: 1.75rem;
          border-radius: 12px;
        `,
      ]}
    >
      <div>
        <p css={css`display: flex; align-items: center; gap: 0.35rem; margin: 0; font-size: 0.92rem; font-weight: 600;`}>
          <SparkleIcon size={12} /> {PRO_PLAN.name}
          <span css={css`font-weight: 400; opacity: 0.85;`}>· {PRO_PLAN.shortPriceLabel}</span>
        </p>
        <p css={css`margin: 0.2rem 0 0; font-size: 0.78rem; opacity: 0.92;`}>{line}</p>
      </div>
      <div css={css`display: flex; gap: 0.45rem; flex-wrap: wrap;`}>
        {state === 'past_due' && canManage && (
          <button type="button" css={proButton} onClick={onPortal} disabled={busy}>
            Update payment method
          </button>
        )}
        {canResume && (
          <button type="button" css={proButton} onClick={onResume} disabled={busy}>
            Resume plan
          </button>
        )}
        {canManage && state !== 'past_due' && (
          <button type="button" css={proGhostButton} onClick={onPortal} disabled={busy}>
            Billing &amp; invoices
          </button>
        )}
        {canCancel && (
          <button type="button" css={proGhostButton} onClick={onCancel} disabled={busy}>
            Cancel plan
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- domain setup ----------

function DomainForm({ initial = '', onSubmit, busy, onCancel }) {
  const [value, setValue] = useState(initial)
  const [touched, setTouched] = useState(false)
  const parsed = value.trim() ? parseDomainInput(value) : null
  const domain = parsed?.domain
  const error = touched && parsed?.error

  let hint = 'A root domain like yourname.com, or a subdomain like blog.yourname.com.'
  if (domain) {
    const partner = companionDomain(domain)
    hint = isSubdomain(domain)
      ? `Subdomain — you’ll add one CNAME record.`
      : `Root domain — you’ll add an A record${partner ? `, and we’ll make ${partner} work too` : ''}.`
    if (domain !== value.trim().toLowerCase()) hint = `We’ll connect ${domain}. ${hint}`
  }

  const submit = event => {
    event.preventDefault()
    setTouched(true)
    if (domain) onSubmit(domain)
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="custom-domain-input" css={css`display: block; margin-bottom: 0.4rem; font-size: 0.8rem; font-weight: 500; color: var(--grey-4);`}>
        Your domain
      </label>
      <div css={css`display: flex; gap: 0.5rem; flex-wrap: wrap;`}>
        <div css={css`flex: 1; min-width: 14rem;`}>
          <DsInput
            id="custom-domain-input"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="blog.yourname.com"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="url"
            aria-invalid={Boolean(error)}
            aria-describedby="custom-domain-hint"
          />
        </div>
        <DsButton type="submit" disabled={busy || !domain}>
          {busy ? 'Connecting…' : 'Connect domain'}
        </DsButton>
        {onCancel && (
          <DsButton type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </DsButton>
        )}
      </div>
      <p
        id="custom-domain-hint"
        css={css`margin: 0.45rem 0 0; font-size: 0.75rem; line-height: 1.5; color: ${error ? '#e5484d' : 'var(--grey-3)'};`}
      >
        {error || hint}
      </p>
    </form>
  )
}

function ConnectedDomain({ domain, onVerify, onRemove, onChange, checking, busy, autoChecking }) {
  const live = domain.status === 'verified'
  const records = domain.records || []
  const lastChecked = domain.lastCheckedAt ? timeAgo(domain.lastCheckedAt) : null

  return (
    <div>
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding: 0.9rem 1rem;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--grey-1);
          box-shadow: var(--chord-shadow-sm);
        `}
      >
        <div css={css`display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; min-width: 0;`}>
          {live ? (
            <a
              href={`https://${domain.domain}`}
              target="_blank"
              rel="noreferrer"
              css={css`font-size: 1rem; font-weight: 600; color: var(--grey-5); text-decoration: none; word-break: break-all; &:hover { text-decoration: underline; }`}
            >
              {domain.domain} ↗
            </a>
          ) : (
            <span css={css`font-size: 1rem; font-weight: 600; color: var(--grey-5); word-break: break-all;`}>{domain.domain}</span>
          )}
          <StatusDot live={live} />
        </div>
        <div css={css`display: flex; gap: 0.4rem; flex-wrap: wrap;`}>
          {!live && (
            <DsButton size="sm" variant="secondary" onClick={onVerify} disabled={checking || busy}>
              {checking ? 'Checking…' : 'Check now'}
            </DsButton>
          )}
          <DsButton size="sm" variant="ghost" onClick={onChange} disabled={busy}>
            Change
          </DsButton>
          <DsButton size="sm" variant="destructive" onClick={onRemove} disabled={busy}>
            Disconnect
          </DsButton>
        </div>
      </div>

      {live ? (
        <div css={css`margin-top: 0.9rem; font-size: 0.82rem; line-height: 1.6; color: var(--grey-4);`}>
          <p css={css`margin: 0;`}>
            🎉 Your profile and posts are live at <strong>https://{domain.domain}</strong>, with HTTPS.
            {domain.companion ? ` ${domain.companion} forwards there too.` : ''}
          </p>
          <p css={css`margin: 0.35rem 0 0; color: var(--grey-3); font-size: 0.78rem;`}>
            Your bublr.life links keep working, and search engines are pointed at your domain.
          </p>
          {records.length > 0 && (
            <details css={css`margin-top: 0.75rem; font-size: 0.78rem; summary { cursor: pointer; color: var(--grey-3); }`}>
              <summary>DNS records</summary>
              <div css={css`margin-top: 0.6rem;`}>
                <DnsRecords records={records} />
              </div>
            </details>
          )}
        </div>
      ) : (
        <div css={css`margin-top: 1rem;`}>
          <p css={css`margin: 0 0 0.25rem; font-size: 0.85rem; font-weight: 500; color: var(--grey-5);`}>
            Add {records.filter(r => r.required).length === 1 ? 'this record' : 'these records'} where you manage your domain’s DNS
          </p>
          <p css={css`margin: 0 0 0.85rem; font-size: 0.78rem; line-height: 1.55; color: var(--grey-3);`}>
            {domain.message || 'Add the records below at your domain registrar.'}
          </p>
          <DnsRecords records={records} />
          <p css={css`margin: 0.75rem 0 0; font-size: 0.75rem; color: var(--grey-3); display: flex; align-items: center; gap: 0.4rem;`}>
            {autoChecking && <Spinner />}
            {autoChecking
              ? 'We check automatically every 30 seconds — you can leave this page, it’ll go live on its own.'
              : 'Your domain goes live on its own once DNS is set.'}
            {lastChecked && ` Last checked ${lastChecked}.`}
          </p>
          <DnsTips records={records} />
        </div>
      )}
    </div>
  )
}

function BrandingForm({ userId, initial, onMessage }) {
  const [text, setText] = useState(initial || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setText(initial || '')
  }, [initial])

  const save = async event => {
    event.preventDefault()
    setSaving(true)
    onMessage(null)
    try {
      const res = await authedFetch('/api/domain/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, footerText: text }),
      })
      const data = await readJson(res)
      onMessage(res.ok ? { tone: 'success', text: 'Footer saved.' } : { tone: 'error', text: data.error || 'Couldn’t save your footer.' })
    } catch (_) {
      onMessage({ tone: 'error', text: 'Couldn’t save your footer.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save}>
      <div css={css`display: flex; gap: 0.5rem; flex-wrap: wrap;`}>
        <div css={css`flex: 1; min-width: 14rem;`}>
          <DsInput
            id="footer-text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Made with Bublr"
            maxLength={100}
            aria-label="Footer text"
          />
        </div>
        <DsButton type="submit" variant="secondary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </DsButton>
      </div>
      <p css={css`margin: 0.45rem 0 0; font-size: 0.75rem; color: var(--grey-3);`}>
        Replaces “Made with Bublr” at the bottom of your profile. Leave it empty to hide the line.
      </p>
    </form>
  )
}

// ---------- the page ----------

export default function CustomDomainPanel({ userId, username }) {
  const router = useRouter()
  const [status, setStatus] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState(null) // { tone, text }
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [confirming, setConfirming] = useState(false) // false | 'waiting' | 'slow'
  const [editingDomain, setEditingDomain] = useState(false)
  const [templateMessage, setTemplateMessage] = useState(null)
  const alive = useRef(true)
  const handledReturn = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const loadStatus = useCallback(async () => {
    if (!userId) return null
    const res = await authedFetch(`/api/subscription/status?userId=${encodeURIComponent(userId)}`)
    const data = await readJson(res)
    if (!res.ok) throw new Error(data.error || 'Could not load your plan')
    if (alive.current) {
      setStatus(data)
      setLoadError(null)
    }
    return data
  }, [userId])

  useEffect(() => {
    if (!userId) return
    loadStatus().catch(err => alive.current && setLoadError(err.message))
  }, [userId, loadStatus])

  const clearQuery = useCallback(() => {
    router.replace(PAGE, undefined, { shallow: true }).catch(() => {})
  }, [router])

  // Back from Dodo checkout: confirm the subscription without waiting for the webhook
  const confirmCheckout = useCallback(
    async subscriptionId => {
      setConfirming('waiting')
      const deadline = Date.now() + CONFIRM_FOR_MS
      let canSync = Boolean(subscriptionId)
      while (alive.current && Date.now() < deadline) {
        try {
          let data
          if (canSync) {
            const res = await authedFetch('/api/subscription/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, subscriptionId }),
            })
            data = await readJson(res)
            if (res.status === 403 || res.status === 404 || res.status === 400) canSync = false
            if (!res.ok) data = await loadStatus()
            else if (alive.current) setStatus(data)
          } else {
            data = await loadStatus()
          }
          if (data?.hasCustomDomainAccess) {
            if (!alive.current) return
            setConfirming(false)
            setNotice({ tone: 'success', text: `You’re on ${PRO_PLAN.name}. Thank you! Now let’s connect your domain.` })
            clearQuery()
            return
          }
          if (data?.subscription?.status === 'failed') break
        } catch (_) {
          // keep trying until the deadline
        }
        await sleep(2500)
      }
      if (alive.current) setConfirming('slow')
    },
    [userId, loadStatus, clearQuery]
  )

  useEffect(() => {
    if (!router.isReady || !userId || handledReturn.current) return
    const { checkout, subscription_id: subscriptionId, status: returnStatus } = router.query
    if (!checkout) return
    handledReturn.current = true
    const failed = ['failed', 'cancelled', 'canceled', 'expired'].includes(String(returnStatus || '').toLowerCase())
    if (checkout === 'success' && !failed) {
      confirmCheckout(typeof subscriptionId === 'string' ? subscriptionId : null)
    } else {
      setNotice({
        tone: 'info',
        text: failed
          ? 'The payment didn’t go through, so you haven’t been charged. You can try again with another card.'
          : 'Checkout cancelled — you haven’t been charged.',
      })
      clearQuery()
    }
  }, [router.isReady, router.query, userId, confirmCheckout, clearQuery])

  const hasAccess = Boolean(status?.hasCustomDomainAccess)
  const domain = status?.customDomain

  const verify = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) {
        setChecking(true)
        setNotice(null)
      }
      try {
        const res = await authedFetch('/api/domain/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        const data = await readJson(res)
        if (!alive.current) return
        if (res.ok) {
          setStatus(prev =>
            prev?.customDomain
              ? {
                  ...prev,
                  customDomain: {
                    ...prev.customDomain,
                    status: data.status,
                    records: data.records,
                    message: data.message,
                    lastCheckedAt: new Date().toISOString(),
                  },
                }
              : prev
          )
          if (data.verified) setNotice({ tone: 'success', text: `${domain?.domain || 'Your domain'} is live! 🎉` })
          else if (!quiet) setNotice({ tone: 'info', text: data.message || 'Not live yet. DNS changes can take a little while.' })
        } else if (!quiet) {
          setNotice({ tone: 'error', text: data.error || 'Couldn’t check your domain.' })
        }
      } catch (_) {
        if (!quiet && alive.current) setNotice({ tone: 'error', text: 'Couldn’t check your domain. Please try again.' })
      } finally {
        if (!quiet && alive.current) setChecking(false)
      }
    },
    [userId, domain?.domain]
  )

  // While a domain is waiting for DNS, keep checking in the background
  const pending = hasAccess && domain?.status === 'pending' && !editingDomain
  useEffect(() => {
    if (!pending) return undefined
    let tries = 0
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      tries += 1
      if (tries > RECHECK_MAX) {
        clearInterval(id)
        return
      }
      verify({ quiet: true })
    }, RECHECK_EVERY_MS)
    return () => clearInterval(id)
  }, [pending, verify])

  const subscribe = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await authedFetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await readJson(res)
      if (res.ok && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl)
        return // keep the button busy while the browser leaves
      }
      if (data.code === 'ALREADY_SUBSCRIBED' || data.code === 'CAN_RESUME' || data.code === 'PAYMENT_ISSUE') {
        await loadStatus()
      }
      setNotice({ tone: 'error', text: data.error || 'Couldn’t open checkout. Please try again.' })
    } catch (_) {
      setNotice({ tone: 'error', text: 'Couldn’t open checkout. Please try again.' })
    }
    setBusy(false)
  }

  const openPortal = async () => {
    setBusy(true)
    setNotice(null)
    // Open the tab now (in the click) so pop-up blockers allow it
    const tab = window.open('', '_blank')
    try {
      const res = await authedFetch('/api/subscription/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await readJson(res)
      if (res.ok && data.portalUrl) {
        if (tab) tab.location.href = data.portalUrl
        else window.location.assign(data.portalUrl)
      } else {
        if (tab) tab.close()
        setNotice({ tone: 'error', text: data.error || 'Couldn’t open billing.' })
      }
    } catch (_) {
      if (tab) tab.close()
      setNotice({ tone: 'error', text: 'Couldn’t open billing.' })
    } finally {
      setBusy(false)
    }
  }

  const managePlan = async action => {
    if (action === 'cancel') {
      const until = formatDate(status?.subscription?.currentPeriodEnd)
      const ok = window.confirm(
        `Cancel ${PRO_PLAN.name}?\n\nYour domain keeps working${until ? ` until ${until}` : ' until the end of this billing period'}. After that, readers are sent to your bublr.life page. Nothing is deleted, and you can resume before then.`
      )
      if (!ok) return
    }
    setBusy(true)
    setNotice(null)
    try {
      const res = await authedFetch('/api/subscription/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      })
      const data = await readJson(res)
      if (res.ok) {
        setStatus(data)
        setNotice({
          tone: 'success',
          text: action === 'cancel'
            ? `Cancelled. ${PRO_PLAN.name} stays on until ${formatDate(data.accessUntil) || 'the end of this period'}.`
            : `Welcome back — ${PRO_PLAN.name} will keep renewing.`,
        })
      } else {
        setNotice({ tone: 'error', text: data.error || 'Couldn’t update your plan.' })
      }
    } catch (_) {
      setNotice({ tone: 'error', text: 'Couldn’t update your plan.' })
    } finally {
      setBusy(false)
    }
  }

  const connect = async value => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await authedFetch('/api/domain/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, domain: value }),
      })
      const data = await readJson(res)
      if (res.ok) {
        setEditingDomain(false)
        await loadStatus()
        setNotice({ tone: data.verified ? 'success' : 'info', text: data.message })
      } else {
        setNotice({ tone: 'error', text: data.error || 'Couldn’t connect that domain.' })
      }
    } catch (_) {
      setNotice({ tone: 'error', text: 'Couldn’t connect that domain. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!domain) return
    if (!window.confirm(`Disconnect ${domain.domain}?\n\nReaders using it will stop reaching your page until you connect it again.`)) return
    setBusy(true)
    setNotice(null)
    try {
      const res = await authedFetch('/api/domain/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await readJson(res)
      if (res.ok) {
        await loadStatus()
        setEditingDomain(false)
        setNotice({ tone: 'success', text: 'Domain disconnected.' })
      } else {
        setNotice({ tone: 'error', text: data.error || 'Couldn’t disconnect the domain.' })
      }
    } catch (_) {
      setNotice({ tone: 'error', text: 'Couldn’t disconnect the domain.' })
    } finally {
      setBusy(false)
    }
  }

  // ---------- render ----------

  if (!userId || (!status && !loadError)) {
    return (
      <div css={css`display: flex; justify-content: center; padding: 3rem 0;`}>
        <Spinner />
      </div>
    )
  }

  if (loadError && !status) {
    return (
      <Banner tone="error" action={<DsButton size="sm" variant="secondary" onClick={() => loadStatus().catch(e => setLoadError(e.message))}>Try again</DsButton>}>
        {loadError}
      </Banner>
    )
  }

  const noticeBanner = notice && <Banner tone={notice.tone}>{notice.text}</Banner>

  if (confirming) {
    return (
      <>
        <div css={[proSurface, heroStyle, css`text-align: center;`]} role="status" aria-live="polite">
          {confirming === 'waiting' ? (
            <>
              <div css={css`display: flex; justify-content: center; margin-bottom: 0.85rem;`}>
                <Spinner />
              </div>
              <h2 css={css`margin: 0 0 0.35rem; font-size: 1.2rem; color: #fff;`}>Confirming your payment…</h2>
              <p css={css`margin: 0; font-size: 0.85rem; opacity: 0.9;`}>This usually takes a few seconds.</p>
            </>
          ) : (
            <>
              <h2 css={css`margin: 0 0 0.35rem; font-size: 1.2rem; color: #fff;`}>Your payment is still processing</h2>
              <p css={css`margin: 0 0 1rem; font-size: 0.85rem; opacity: 0.9;`}>
                Some payment methods take a little longer. We’ll switch {PRO_PLAN.name} on as soon as it’s confirmed — and email you.
              </p>
              <button
                type="button"
                css={proButton}
                onClick={() => confirmCheckout(typeof router.query.subscription_id === 'string' ? router.query.subscription_id : null)}
              >
                Check again
              </button>
            </>
          )}
        </div>
      </>
    )
  }

  if (!hasAccess) {
    const savedDomain = domain?.domain
    return (
      <>
        {noticeBanner}
        {status.state === 'past_due' && (
          <Banner
            tone="error"
            action={status.subscription?.canManageBilling && (
              <DsButton size="sm" onClick={openPortal} disabled={busy}>Update payment method</DsButton>
            )}
          >
            Your last payment didn’t go through{savedDomain ? `, so ${savedDomain} is offline` : ''}. Update your payment method to switch {PRO_PLAN.name} back on.
          </Banner>
        )}
        {status.state === 'ended' && savedDomain && (
          <Banner tone="info">
            Welcome back! <strong>{savedDomain}</strong> and your settings are saved — they come back the moment you resubscribe.
          </Banner>
        )}
        {status.checkoutPending && status.state !== 'past_due' && (
          <Banner tone="info" action={<DsButton size="sm" variant="secondary" onClick={() => confirmCheckout(null)}>Check status</DsButton>}>
            Already paid? It can take a minute for your payment to be confirmed.
          </Banner>
        )}
        {status.state === 'past_due' ? null : (
          <ProPitch username={username} status={status} onSubscribe={subscribe} busy={busy} />
        )}
        <HowItWorks />
      </>
    )
  }

  return (
    <>
      {noticeBanner}
      <PlanStrip
        status={status}
        busy={busy}
        onPortal={openPortal}
        onCancel={() => managePlan('cancel')}
        onResume={() => managePlan('resume')}
      />

      <DsSection
        title="Your domain"
        description={domain && !editingDomain ? null : 'Connect a domain you own. Your profile appears at its root and each post at /post-name.'}
      >
        {status.domainsConfigured === false ? (
          <Banner tone="warning">Custom domains are being set up on our side. Check back shortly.</Banner>
        ) : domain && !editingDomain ? (
          <ConnectedDomain
            domain={domain}
            busy={busy}
            checking={checking}
            autoChecking={pending}
            onVerify={() => verify()}
            onRemove={disconnect}
            onChange={() => {
              setNotice(null)
              setEditingDomain(true)
            }}
          />
        ) : (
          <DomainForm
            initial={editingDomain ? domain?.domain || '' : ''}
            busy={busy}
            onSubmit={connect}
            onCancel={editingDomain ? () => setEditingDomain(false) : null}
          />
        )}
      </DsSection>

      <DsSection title="Footer text" description="Your name on your page, not ours.">
        <BrandingForm userId={userId} initial={status.customBranding?.footerText} onMessage={setNotice} />
      </DsSection>

      <DsSection title="Newsletter email" description="Design the email your subscribers get when you publish.">
        {templateMessage && <Banner tone={templateMessage.tone}>{templateMessage.text}</Banner>}
        <NewsletterTemplateSection
          userId={userId}
          hasAccess={hasAccess}
          currentTemplate={status.newsletterTemplate}
          onError={text => setTemplateMessage(text ? { tone: 'error', text } : null)}
          onSuccess={text => setTemplateMessage(text ? { tone: 'success', text } : null)}
        />
      </DsSection>
    </>
  )
}
