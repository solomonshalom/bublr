/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

import { formatPrice, getAddressError, getAddressFieldErrors, regionRequired } from '../../lib/shop'
import { authedFetch } from '../../lib/authed-fetch'
import { countryList, formatPhoneNumber, getDialCode, guessCountry } from './countries'
import { EASE, blockTokens } from './tokens'

/**
 * Checkout sheet, ported from supply-checkout-modal.tsx on jeremybosma.nl
 * (github.com/jeremybosma/jeremybosma, by Jeremy Bosma). Collects who the
 * item goes to, shows the total, then hands over to the writer's own
 * Stripe/Creem checkout. Shipping is the writer's flat rate, so there is no
 * separate "calculate shipping" step. Digital items only need a name and email.
 */

const STORAGE_KEY = 'bublr-shop-checkout'

const EMPTY = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country: '',
  region: '',
  address1: '',
  address2: '',
  city: '',
  zip: '',
}

function loadStored() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    return parsed && typeof parsed === 'object' ? { ...EMPTY, ...parsed.address, phoneLocal: parsed.phoneLocal || '' } : null
  } catch (_) {
    return null
  }
}

function saveStored(address, phoneLocal) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ address, phoneLocal }))
  } catch (_) {
    // private mode
  }
}

const inputStyle = hasError => css`
  margin-top: 4px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid ${hasError ? 'var(--blk-danger)' : 'var(--blk-border)'};
  border-radius: 6px;
  background: transparent;
  color: var(--blk-fg);
  font: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color 0.18s ${EASE};
  &:focus {
    border-color: ${hasError ? 'var(--blk-danger)' : 'var(--blk-muted)'};
  }
  &:disabled {
    opacity: 0.6;
  }
`

const labelStyle = css`
  display: block;
  font-size: 13px;
  span.blk-label {
    color: var(--blk-muted);
  }
`

const errorText = css`
  margin-top: 4px;
  font-size: 12px;
  color: var(--blk-danger);
`

function Field({ label, value, onChange, type = 'text', autoComplete, inputMode, error }) {
  return (
    <label css={labelStyle}>
      <span className="blk-label">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        onChange={event => onChange(event.target.value)}
        css={inputStyle(Boolean(error))}
      />
      {error ? <p css={errorText}>{error}</p> : null}
    </label>
  )
}

function CountrySelect({ value, onChange, error }) {
  const countries = useMemo(() => countryList(), [])
  return (
    <label css={labelStyle}>
      <span className="blk-label">Country</span>
      <select
        value={value}
        aria-invalid={error ? true : undefined}
        autoComplete="country"
        onChange={event => onChange(event.target.value)}
        css={[inputStyle(Boolean(error)), css`appearance: auto;`]}
      >
        <option value="" disabled>
          Select country
        </option>
        {countries.map(country => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>
      {error ? <p css={errorText}>{error}</p> : null}
    </label>
  )
}

function PhoneField({ dialCode, value, countrySelected, onChange, error }) {
  return (
    <label css={labelStyle}>
      <span className="blk-label">Phone (optional)</span>
      <div css={css`margin-top: 4px; display: flex; gap: 8px;`}>
        <div
          aria-hidden="true"
          css={css`
            flex-shrink: 0;
            padding: 8px 12px;
            border: 1px solid var(--blk-border);
            border-radius: 6px;
            font-size: 14px;
            font-variant-numeric: tabular-nums;
            color: ${countrySelected ? 'var(--blk-fg)' : 'var(--blk-muted)'};
          `}
        >
          {dialCode || '-'}
        </div>
        <input
          type="tel"
          value={value}
          disabled={!countrySelected}
          autoComplete="tel-national"
          inputMode="tel"
          placeholder={countrySelected ? '6 12345678' : 'Select country first'}
          aria-invalid={error ? true : undefined}
          onChange={event => onChange(event.target.value)}
          css={[inputStyle(Boolean(error)), css`margin-top: 0; min-width: 0; flex: 1;`]}
        />
      </div>
      <p css={css`margin-top: 4px; font-size: 12px; color: var(--blk-muted);`}>
        {countrySelected ? 'Enter your local number without the country code.' : 'Choose your country so we can format your phone number correctly.'}
      </p>
      {error ? <p css={errorText}>{error}</p> : null}
    </label>
  )
}

export default function CheckoutModal({ open, onClose, username, product, variant }) {
  const physical = product.kind === 'physical'
  const [address, setAddress] = useState(EMPTY)
  const [phoneLocal, setPhoneLocal] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const fieldErrors = useMemo(() => getAddressFieldErrors(address, { physical }), [address, physical])

  useEffect(() => {
    if (!open) {
      setSubmitting(false)
      setError(null)
      setShowErrors(false)
      return undefined
    }
    const stored = loadStored()
    if (stored) {
      const { phoneLocal: storedPhone, ...rest } = stored
      setAddress(rest)
      setPhoneLocal(storedPhone || '')
    } else {
      setAddress({ ...EMPTY, country: guessCountry() })
      setPhoneLocal('')
    }
    const onKey = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  const update = useCallback(
    (field, value) => {
      setAddress(current => {
        const next = { ...current, [field]: value }
        next.phone = formatPhoneNumber(phoneLocal, next.country)
        saveStored(next, phoneLocal)
        return next
      })
      setError(null)
    },
    [phoneLocal]
  )

  const updatePhone = value => {
    const sanitized = value.replace(/[^\d\s-]/g, '')
    setPhoneLocal(sanitized)
    setAddress(current => {
      const next = { ...current, phone: formatPhoneNumber(sanitized, current.country) }
      saveStored(next, sanitized)
      return next
    })
    setError(null)
  }

  const subtotal = product.price
  const shipping = physical ? product.shipping || 0 : 0
  const total = subtotal + shipping

  const handleCheckout = async () => {
    setShowErrors(true)
    const problem = getAddressError(address, { physical })
    if (problem) {
      setError(problem)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Signed-in buyers send their token: in test mode only the writer may buy.
      const response = await authedFetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          productId: product.id,
          colorId: variant.color?.id || null,
          sizeId: variant.size?.id || null,
          buyer: address,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || 'Failed to start checkout')
      window.location.assign(data.checkoutUrl)
    } catch (checkoutError) {
      setError(checkoutError.message || 'Failed to start checkout')
      setSubmitting(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="checkout"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          data-lenis-prevent
          css={[
            blockTokens,
            css`
              position: fixed;
              inset: 0;
              z-index: 1000;
              display: flex;
              align-items: flex-end;
              justify-content: center;
              padding: 16px;
              background: rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(4px);
              -webkit-backdrop-filter: blur(4px);
              font-family: Inter, sans-serif;
              color: var(--blk-fg);
              @media (min-width: 640px) {
                align-items: center;
              }
            `,
          ]}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Checkout"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={event => event.stopPropagation()}
            css={css`
              width: 100%;
              max-width: 512px;
              border-radius: 12px;
              border: 1px solid var(--blk-border);
              background: var(--blk-bg);
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                border-bottom: 1px solid var(--blk-border);
                padding: 16px 20px;
              `}
            >
              <div>
                <h2 css={css`font-size: 18px; font-weight: 600; margin: 0; color: var(--blk-fg);`}>Checkout</h2>
                <p css={css`font-size: 13px; color: var(--blk-muted); margin-top: 4px;`}>
                  {product.title}
                  {variant.title ? ` · ${variant.title}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                css={css`
                  border: 0;
                  background: none;
                  font: inherit;
                  font-size: 13px;
                  color: var(--blk-muted);
                  transition: color 0.18s ${EASE};
                  &:hover {
                    color: var(--blk-fg);
                  }
                `}
              >
                Close
              </button>
            </div>

            <div
              css={css`
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                max-height: 70dvh;
                overflow-y: auto;
                overscroll-behavior: contain;
              `}
            >
              <div css={css`display: grid; grid-template-columns: 1fr 1fr; gap: 12px;`}>
                <Field label="First name" value={address.first_name} autoComplete="given-name" error={showErrors ? fieldErrors.first_name : undefined} onChange={v => update('first_name', v)} />
                <Field label="Last name" value={address.last_name} autoComplete="family-name" error={showErrors ? fieldErrors.last_name : undefined} onChange={v => update('last_name', v)} />
              </div>

              <Field label="Email" type="email" inputMode="email" value={address.email} autoComplete="email" error={showErrors ? fieldErrors.email : undefined} onChange={v => update('email', v)} />

              {physical ? (
                <>
                  <CountrySelect value={address.country} error={showErrors ? fieldErrors.country : undefined} onChange={v => update('country', v)} />
                  <PhoneField
                    dialCode={getDialCode(address.country)}
                    value={phoneLocal}
                    countrySelected={Boolean(address.country)}
                    error={showErrors ? fieldErrors.phone : undefined}
                    onChange={updatePhone}
                  />
                  <Field label="Street address" value={address.address1} autoComplete="address-line1" error={showErrors ? fieldErrors.address1 : undefined} onChange={v => update('address1', v)} />
                  <Field label="Apartment, suite, etc. (optional)" value={address.address2} autoComplete="address-line2" onChange={v => update('address2', v)} />
                  <div css={css`display: grid; grid-template-columns: 1fr 1fr; gap: 12px;`}>
                    <Field label="City" value={address.city} autoComplete="address-level2" error={showErrors ? fieldErrors.city : undefined} onChange={v => update('city', v)} />
                    <Field label="Postal code" value={address.zip} autoComplete="postal-code" error={showErrors ? fieldErrors.zip : undefined} onChange={v => update('zip', v)} />
                  </div>
                  <Field
                    label={regionRequired(address.country) ? 'State / province' : 'Region (optional)'}
                    value={address.region}
                    autoComplete="address-level1"
                    error={showErrors ? fieldErrors.region : undefined}
                    onChange={v => update('region', v)}
                  />
                </>
              ) : null}

              <div
                css={css`
                  border-radius: 6px;
                  border: 1px solid var(--blk-border);
                  background: var(--blk-secondary);
                  padding: 12px 16px;
                  font-size: 14px;
                  display: flex;
                  flex-direction: column;
                  gap: 4px;
                  div {
                    display: flex;
                    justify-content: space-between;
                  }
                `}
              >
                <div>
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal, product.currency)}</span>
                </div>
                {physical ? (
                  <div css={css`color: var(--blk-muted);`}>
                    <span>Shipping</span>
                    <span>{shipping ? formatPrice(shipping, product.currency) : 'Free'}</span>
                  </div>
                ) : null}
                <div css={css`font-weight: 500; padding-top: 4px; border-top: 1px solid var(--blk-border);`}>
                  <span>Total</span>
                  <span>{formatPrice(total, product.currency)}</span>
                </div>
              </div>

              {error ? <p css={css`font-size: 13px; color: var(--blk-danger);`}>{error}</p> : null}

              <button
                type="button"
                disabled={submitting}
                onClick={handleCheckout}
                css={css`
                  width: 100%;
                  padding: 12px 16px;
                  font: inherit;
                  font-size: 14px;
                  font-weight: 500;
                  border-radius: 6px;
                  border: 1px solid var(--blk-fg);
                  background: var(--blk-fg);
                  color: var(--blk-bg);
                  transition: opacity 0.18s ${EASE}, transform 0.12s ${EASE};
                  &:hover {
                    opacity: 0.9;
                  }
                  &:active {
                    transform: scale(0.99);
                  }
                  &:disabled {
                    opacity: 0.6;
                  }
                `}
              >
                {submitting ? 'Redirecting to payment...' : `Continue to payment · ${formatPrice(total, product.currency)}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
