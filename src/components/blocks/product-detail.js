/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthState } from 'react-firebase-hooks/auth'

import { auth } from '../../lib/firebase'

import { formatPrice, isVariantAvailable } from '../../lib/shop'
import CheckoutModal from './checkout-modal'
import { EASE, blockTokens, panelIn, vtName } from './tokens'
import { navigateWithTransition } from './vt-navigation'

/**
 * Product page, ported from supply-product-page.tsx, product-detail-gallery.tsx
 * and product-detail-panel.tsx on jeremybosma.nl (github.com/jeremybosma/
 * jeremybosma, by Jeremy Bosma): a big photo with thumbnails, colour swatches,
 * size buttons and one "Purchase for …" button. The photo and the title morph
 * in from the shop grid.
 */

function ChevronLeft(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

const optionButton = (selected, disabled) => css`
  padding: 6px 12px;
  font: inherit;
  font-size: 14px;
  border-radius: 6px;
  border: 1px solid ${selected ? 'var(--blk-fg)' : 'var(--blk-border)'};
  background: ${selected ? 'var(--blk-fg)' : 'transparent'};
  color: ${selected ? 'var(--blk-bg)' : 'var(--blk-fg)'};
  opacity: ${disabled ? 0.3 : 1};
  cursor: ${disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.18s ${EASE};
  &:hover:not(:disabled) {
    border-color: ${selected ? 'var(--blk-fg)' : 'var(--blk-muted)'};
  }
`

export default function ProductDetail({ product, username, writerName, onCustomDomain = false, paymentsReady = true, testMode = false, ownerId = null }) {
  const router = useRouter()
  const [currentUser] = useAuthState(auth)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  // With a test key connected, only the writer can buy (to try it out). Known
  // only after hydration: the server-rendered button is the visitor's, and
  // React 17 doesn't fix attributes that differ on the first client render.
  const isOwner = Boolean(hydrated && currentUser && ownerId && currentUser.uid === ownerId)
  const canSell = paymentsReady && (!testMode || isOwner)
  const colors = product.colors || []
  const sizes = product.sizes || []
  const availableColors = colors.filter(c => c.available !== false)

  const [colorId, setColorId] = useState(() => (availableColors[0] || colors[0])?.id || null)
  const [sizeId, setSizeId] = useState(() => (sizes.find(s => s.available !== false) || sizes[0])?.id || null)
  const [imageIndex, setImageIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const color = colors.find(c => c.id === colorId) || null
  const size = sizes.find(s => s.id === sizeId) || null
  const images = product.images || []

  // Picking a colour shows its photo (the reference filters photos per variant).
  useEffect(() => {
    if (!color?.image) return
    const index = images.indexOf(color.image)
    if (index >= 0) setImageIndex(index)
  }, [color?.image]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentImage = images[imageIndex] || images[0] || null
  const canPurchase = canSell && isVariantAvailable(product, colorId, sizeId)
  const variantTitle = [color?.title, size?.title].filter(Boolean).join(' / ')

  const backHref = onCustomDomain ? '/' : `/${username}`
  const goBack = useCallback(
    event => {
      if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return
      event?.preventDefault()
      navigateWithTransition(router, backHref, { scrollToId: 'shop' })
    },
    [router, backHref]
  )

  // Coming back from the writer's checkout page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    if (!checkout) return undefined
    const checkoutId = params.get('checkout_id') || params.get('session_id')
    const clean = () => {
      for (const key of ['checkout', 'checkout_id', 'session_id', 'order_id', 'customer_id', 'product_id', 'request_id', 'signature', 'subscription_id']) {
        params.delete(key)
      }
      const search = params.toString()
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
    }

    if (checkout === 'cancelled') {
      setNotice({ type: 'cancelled', message: 'Payment was cancelled. You can try again when ready.' })
      clean()
      return undefined
    }
    if (checkout !== 'success' || !checkoutId) {
      clean()
      return undefined
    }

    let cancelled = false
    setNotice({ type: 'pending', message: 'Confirming your payment…' })
    const confirm = async (attempt = 0) => {
      try {
        const response = await fetch(`/api/shop/checkout-complete?${new URLSearchParams({ user: username, checkout_id: checkoutId })}`)
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (response.status === 202 && attempt < 5) {
          setTimeout(() => confirm(attempt + 1), 2000)
          return
        }
        if (!response.ok || !data.paid) throw new Error(data.error || data.message || 'We couldn’t confirm the payment yet.')
        setNotice({
          type: 'success',
          message:
            data.kind === 'digital'
              ? `Payment received. Thank you!${data.delivery ? '' : ` ${writerName || 'The writer'} will send it to you by email.`}`
              : `Payment received. ${writerName || 'The writer'} has your order and will ship it soon.`,
          delivery: data.delivery || null,
        })
        clean()
      } catch (error) {
        if (!cancelled) setNotice({ type: 'error', message: error.message })
      }
    }
    confirm()
    return () => {
      cancelled = true
    }
  }, [username, writerName])

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closeCheckout = useCallback(() => setCheckoutOpen(false), [])

  const noticeStyle = useMemo(() => {
    if (!notice) return null
    if (notice.type === 'success') return css`border-color: rgba(22, 163, 74, 0.3); background: rgba(22, 163, 74, 0.1); color: #166534; [data-theme='dark'] & { color: #86efac; }`
    if (notice.type === 'error') return css`border-color: rgba(220, 38, 38, 0.3); background: rgba(220, 38, 38, 0.1); color: #b91c1c; [data-theme='dark'] & { color: #fca5a5; }`
    return css`border-color: var(--blk-border); background: var(--blk-secondary); color: var(--blk-muted);`
  }, [notice])

  return (
    <article
      css={[
        blockTokens,
        css`
          display: flex;
          gap: 16px;
          font-size: 17px;
          color: var(--blk-fg);
          animation: ${panelIn} 0.5s ${EASE} both;
          html.shop-vt & {
            animation: none;
          }
          @media (prefers-reduced-motion: reduce) {
            animation: none;
          }
        `,
      ]}
    >
      <a
        href={backHref}
        onClick={goBack}
        aria-label={`Back to ${writerName || 'the shop'}`}
        css={css`
          flex-shrink: 0;
          margin-top: 2px;
          display: flex;
          width: 36px;
          height: 36px;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          border: 1px solid var(--blk-border);
          background: var(--blk-secondary);
          color: var(--blk-muted);
          transition: background 0.18s ${EASE}, color 0.18s ${EASE};
          svg {
            transition: transform 0.18s ${EASE};
          }
          &:hover {
            background: var(--blk-secondary-strong);
            color: var(--blk-fg);
          }
          &:hover svg {
            transform: translateX(-2px);
          }
        `}
      >
        <ChevronLeft />
      </a>

      <div
        css={css`
          display: grid;
          gap: 32px;
          min-width: 0;
          flex: 1;
          @media (min-width: 768px) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        `}
      >
        <div>
          <button
            type="button"
            onClick={() => currentImage && setLightboxOpen(true)}
            aria-label={`View ${product.title} images in fullscreen`}
            css={css`
              aspect-ratio: 1 / 1;
              position: relative;
              width: 100%;
              overflow: hidden;
              border: 0;
              padding: 0;
              background: var(--blk-secondary);
              cursor: zoom-in;
              display: block;
            `}
          >
            {currentImage ? (
              <img
                src={currentImage}
                alt={`${product.title} product image`}
                style={{ viewTransitionName: vtName('shop-image', product.id) }}
                css={css`
                  position: absolute;
                  inset: 0;
                  width: 100%;
                  height: 100%;
                  object-fit: contain;
                `}
              />
            ) : null}
          </button>

          {images.length > 1 ? (
            <div css={css`display: flex; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none;`} data-lenis-prevent>
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`${product.title} thumbnail view ${index + 1}`}
                  css={css`
                    position: relative;
                    width: 72px;
                    height: 72px;
                    flex-shrink: 0;
                    overflow: hidden;
                    padding: 0;
                    background: none;
                    border: 1px solid ${index === imageIndex ? 'var(--blk-border)' : 'transparent'};
                    transition: border-color 0.18s ${EASE};
                    &:hover {
                      border-color: ${index === imageIndex ? 'var(--blk-border)' : 'var(--blk-muted)'};
                    }
                  `}
                >
                  <img
                    src={src}
                    alt={`${product.title} thumbnail view ${index + 1}`}
                    loading="lazy"
                    css={css`position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: var(--blk-secondary);`}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div css={css`display: flex; flex-direction: column; gap: 24px;`}>
          <div>
            <h1
              style={{ viewTransitionName: vtName('shop-title', product.id) }}
              css={css`
                font-size: 24px;
                font-weight: 600;
                line-height: 1.25;
                margin: 0 0 8px;
                color: var(--blk-fg);
                width: fit-content;
              `}
            >
              {product.title}
            </h1>
            {product.description ? (
              <p css={css`font-size: 14px; line-height: 1.6; color: var(--blk-muted); white-space: pre-line;`}>{product.description}</p>
            ) : null}
          </div>

          {colors.length > 0 ? (
            <div>
              <p css={css`font-size: 14px; font-weight: 500;`}>
                {'Color: '}
                <span css={css`color: var(--blk-muted); font-weight: 400;`}>{color?.title}</span>
              </p>
              {availableColors.length > 1 ? (
                <div css={css`display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;`}>
                  {availableColors.map(option => {
                    const selected = option.id === colorId
                    return (
                      <button
                        key={option.id}
                        type="button"
                        title={option.title}
                        aria-label={option.title}
                        aria-pressed={selected}
                        onClick={() => setColorId(option.id)}
                        style={{ backgroundColor: option.hex }}
                        css={css`
                          width: 32px;
                          height: 32px;
                          border-radius: 9999px;
                          border: 1px solid ${selected ? 'var(--blk-fg)' : 'transparent'};
                          box-shadow: inset 0 0 0 1px var(--blk-border);
                          transform: scale(${selected ? 1.1 : 1});
                          transition: transform 0.18s ${EASE}, border-color 0.18s ${EASE};
                          &:hover {
                            border-color: ${selected ? 'var(--blk-fg)' : 'var(--blk-muted)'};
                          }
                        `}
                      />
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {sizes.length > 0 ? (
            <div>
              <p css={css`font-size: 14px; font-weight: 500; margin-bottom: 8px;`}>
                {'Size: '}
                <span css={css`color: var(--blk-muted); font-weight: 400;`}>{size?.title}</span>
              </p>
              <div css={css`display: flex; flex-wrap: wrap; gap: 8px;`}>
                {sizes.map(option => {
                  const available = isVariantAvailable(product, colorId, option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!available}
                      aria-pressed={option.id === sizeId}
                      onClick={() => setSizeId(option.id)}
                      css={optionButton(option.id === sizeId, !available)}
                    >
                      {option.title}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {testMode && isOwner ? (
            <div css={css`border-radius: 6px; border: 1px dashed var(--blk-border); padding: 10px 14px; font-size: 13px; line-height: 1.5; color: var(--blk-muted);`}>
              Test mode: your shop uses a test key, so only you can buy, with a test card. Visitors see “Not available yet” until you connect a live key.
            </div>
          ) : null}

          {notice ? (
            <div role="status" css={[css`border-radius: 6px; border: 1px solid; padding: 12px 16px; font-size: 14px; line-height: 1.5;`, noticeStyle]}>
              {notice.message}
              {notice.delivery ? (
                <>
                  {' '}
                  <a href={notice.delivery} target="_blank" rel="noreferrer" css={css`color: inherit; font-weight: 500; text-decoration: underline;`}>
                    Download
                  </a>
                </>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!canPurchase}
            onClick={() => canPurchase && setCheckoutOpen(true)}
            css={css`
              width: 100%;
              padding: 12px 16px;
              font: inherit;
              font-size: 14px;
              font-weight: 500;
              border-radius: 6px;
              border: 1px solid ${canPurchase ? 'var(--blk-fg)' : 'var(--blk-border)'};
              background: ${canPurchase ? 'var(--blk-fg)' : 'var(--blk-secondary)'};
              color: ${canPurchase ? 'var(--blk-bg)' : 'var(--blk-muted)'};
              opacity: ${canPurchase ? 1 : 0.6};
              cursor: ${canPurchase ? 'pointer' : 'not-allowed'};
              transition: opacity 0.18s ${EASE}, transform 0.12s ${EASE};
              &:hover:not(:disabled) {
                opacity: 0.9;
              }
              &:active:not(:disabled) {
                transform: scale(0.99);
              }
            `}
          >
            {canPurchase ? `Purchase for ${formatPrice(product.price, product.currency)}` : canSell ? 'Out of Stock' : 'Not available yet'}
          </button>
        </div>
      </div>

      <CheckoutModal
        open={checkoutOpen}
        onClose={closeCheckout}
        username={username}
        product={product}
        variant={{ color, size, title: variantTitle }}
      />

      {mounted
        ? createPortal(
            <AnimatePresence>
              {lightboxOpen && currentImage ? (
                <motion.div
                  key="lightbox"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setLightboxOpen(false)}
                  data-lenis-prevent
                  css={css`
                    position: fixed;
                    inset: 0;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: zoom-out;
                  `}
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    css={css`position: absolute; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);`}
                  />
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    css={css`position: relative; z-index: 10; padding: 16px;`}
                  >
                    <img
                      src={currentImage}
                      alt={`${product.title} fullscreen view`}
                      css={css`max-width: 90vw; max-height: 85dvh; width: auto; height: auto; object-fit: contain; display: block;`}
                    />
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </article>
  )
}
