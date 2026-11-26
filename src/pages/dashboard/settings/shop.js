/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useEffect, useMemo, useState } from 'react'

import { firestore } from '../../../lib/firebase'
import { authedFetch } from '../../../lib/authed-fetch'
import { hasActiveShopAccess } from '../../../lib/subscription'

// Display only: the server checks the signed grant (lib/shop-trust) itself.
const shopIsOpen = user => hasActiveShopAccess(user) && Boolean(user.shopGrant)
import {
  CURRENCIES,
  MAX_IMAGES,
  MAX_OPTIONS,
  MAX_PRODUCTS,
  PROVIDERS,
  centsToInput,
  formatPrice,
  newId,
  parsePriceInput,
  publicProducts,
} from '../../../lib/shop'
import { DsSection, DsTray, DsTile } from '../../../components/dashboard/ds-section'
import { DsInput, DsTextarea, DsLabel, DsField } from '../../../components/dashboard/ds-input'
import DsButton from '../../../components/dashboard/ds-button'
import DsSwitch from '../../../components/dashboard/ds-switch'
import ShopGrid from '../../../components/blocks/shop-grid'
import { PaymentsPanel, PlanGate, noticeStyle } from '../../../components/dashboard/payments-panel'
import { BlockStyles } from '../../../components/blocks/tokens'
import {
  BlockSettingsPage,
  LoadingContainer,
  Segmented,
  UploadButton,
  helpText,
  iconButton,
  moveItem,
  previewFrame,
  useCurrentUserDoc,
  withBlockLayout,
} from '../../../components/dashboard/block-editor-kit'

// ------------------------------------------------------------ products

const emptyProduct = currency => ({
  id: newId(10),
  title: '',
  description: '',
  images: [],
  price: null,
  priceInput: '',
  currency: currency || 'usd',
  kind: 'physical',
  shipping: 0,
  shippingInput: '',
  colors: [],
  sizes: [],
  soldOut: false,
  active: true,
  hasDelivery: false,
})

function toDraft(product) {
  return { ...product, priceInput: centsToInput(product.price), shippingInput: product.shipping ? centsToInput(product.shipping) : '' }
}

function fromDraft(draft) {
  const { priceInput, shippingInput, hasDelivery, deliveryInput, clearDelivery, ...product } = draft
  return {
    ...product,
    price: parsePriceInput(priceInput),
    shipping: product.kind === 'physical' ? parsePriceInput(shippingInput) || 0 : 0,
  }
}

const smallLabel = css`
  font-size: 0.72rem;
  color: var(--grey-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.4rem;
  display: block;
`

function OptionsEditor({ kind, options, images, onChange }) {
  const [text, setText] = useState('')
  const add = () => {
    const title = text.trim()
    if (!title || options.length >= MAX_OPTIONS) return
    onChange([...options, kind === 'color' ? { id: newId(8), title, hex: '#888888', image: null, available: true } : { id: newId(8), title, available: true }])
    setText('')
  }
  return (
    <div>
      <span css={smallLabel}>{kind === 'color' ? 'Colours' : 'Sizes'}</span>
      <div css={css`display: flex; flex-direction: column; gap: 0.35rem;`}>
        {options.map((option, index) => (
          <div key={option.id} css={css`display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.82rem;`}>
            {kind === 'color' ? (
              <input
                type="color"
                value={option.hex}
                aria-label={`${option.title} colour`}
                onChange={event => onChange(options.map(o => (o.id === option.id ? { ...o, hex: event.target.value } : o)))}
                css={css`width: 28px; height: 28px; padding: 0; border: 1px solid var(--border); border-radius: 50%; background: none; overflow: hidden; &::-webkit-color-swatch-wrapper { padding: 0; } &::-webkit-color-swatch { border: 0; border-radius: 50%; }`}
              />
            ) : null}
            <span css={css`min-width: 60px; color: var(--grey-4);`}>{option.title}</span>
            {kind === 'color' && images.length ? (
              <select
                value={option.image || ''}
                aria-label={`Photo for ${option.title}`}
                onChange={event => onChange(options.map(o => (o.id === option.id ? { ...o, image: event.target.value || null } : o)))}
                css={css`font: inherit; font-size: 0.75rem; padding: 0.2rem 0.3rem; border-radius: 4px; border: 1px solid var(--border); background: var(--grey-1); color: var(--grey-4);`}
              >
                <option value="">No photo</option>
                {images.map((src, i) => (
                  <option key={src} value={src}>Photo {i + 1}</option>
                ))}
              </select>
            ) : null}
            <DsSwitch
              size="sm"
              checked={option.available !== false}
              onChange={available => onChange(options.map(o => (o.id === option.id ? { ...o, available } : o)))}
              label="In stock"
            />
            <span css={css`flex: 1;`} />
            <button type="button" css={iconButton} disabled={index === 0} aria-label="Move up" onClick={() => onChange(moveItem(options, index, index - 1))}>↑</button>
            <button type="button" css={iconButton} aria-label={`Remove ${option.title}`} onClick={() => onChange(options.filter(o => o.id !== option.id))}>×</button>
          </div>
        ))}
      </div>
      <div css={css`display: flex; gap: 0.4rem; margin-top: 0.4rem;`}>
        <DsInput
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          placeholder={kind === 'color' ? 'Add a colour, e.g. White' : 'Add a size, e.g. M'}
          maxLength={kind === 'color' ? 32 : 16}
          aria-label={kind === 'color' ? 'New colour' : 'New size'}
        />
        <DsButton size="sm" variant="outline" onClick={add} disabled={!text.trim() || options.length >= MAX_OPTIONS}>Add</DsButton>
      </div>
    </div>
  )
}

function ProductForm({ draft, onChange, onClose, onDelete, provider }) {
  const set = patch => onChange({ ...draft, ...patch })
  const priceOk = parsePriceInput(draft.priceInput) != null
  const currencies = provider ? PROVIDERS[provider].currencies : Object.keys(CURRENCIES)
  const physicalBlocked = provider === 'creem' && draft.kind === 'physical'

  return (
    <div css={css`display: flex; flex-direction: column; gap: 1rem;`}>
      <DsField css={css`margin: 0;`}>
        <DsLabel htmlFor={`title-${draft.id}`}>Name</DsLabel>
        <DsInput id={`title-${draft.id}`} value={draft.title} maxLength={80} placeholder="e.g. Rich Kids tee" onChange={event => set({ title: event.target.value })} />
      </DsField>

      <div>
        <span css={smallLabel}>Photos</span>
        <div css={css`display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-start;`}>
          {draft.images.map((src, index) => (
            <div key={src} css={css`position: relative; width: 84px; height: 84px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); background: var(--accent-bg-strong); &:hover .ph-actions { opacity: 1; }`}>
              <img src={src} alt="" css={css`width: 100%; height: 100%; object-fit: contain;`} />
              <div className="ph-actions" css={css`position: absolute; right: 3px; bottom: 3px; display: flex; gap: 2px; opacity: 0; transition: opacity 120ms ease; @media (hover: none) { opacity: 1; } button { width: 20px; height: 20px; }`}>
                <button type="button" css={iconButton} disabled={index === 0} aria-label="Move earlier" onClick={() => set({ images: moveItem(draft.images, index, index - 1) })}>‹</button>
                <button type="button" css={iconButton} aria-label="Remove photo" onClick={() => set({ images: draft.images.filter(i => i !== src), colors: draft.colors.map(c => (c.image === src ? { ...c, image: null } : c)) })}>×</button>
              </div>
              {index === 0 ? <span css={css`position: absolute; left: 3px; top: 3px; font-size: 0.55rem; padding: 1px 4px; border-radius: 3px; background: var(--accent); color: #fff; [data-theme='dark'] & { color: #15162e; }`}>MAIN</span> : null}
            </div>
          ))}
          <UploadButton accept="image/*" disabled={draft.images.length >= MAX_IMAGES} onUploaded={uploads => set({ images: [...draft.images, ...uploads.filter(u => u.type === 'image').map(u => u.url)].slice(0, MAX_IMAGES) })}>
            + Photos
          </UploadButton>
        </div>
      </div>

      <DsField css={css`margin: 0;`}>
        <DsLabel htmlFor={`desc-${draft.id}`}>Description</DsLabel>
        <DsTextarea id={`desc-${draft.id}`} value={draft.description} maxLength={2000} placeholder="Material, fit, what’s included…" onChange={event => set({ description: event.target.value })} />
      </DsField>

      <div>
        <span css={smallLabel}>Type</span>
        <Segmented
          label="Product type"
          value={draft.kind}
          onChange={kind => set({ kind })}
          options={[
            { value: 'physical', label: 'Something I ship' },
            { value: 'digital', label: 'Digital' },
          ]}
        />
        {physicalBlocked ? <p css={[helpText, css`margin-top: 0.4rem; color: #b45309;`]}>Creem doesn’t allow physical goods. Connect Stripe to sell things you ship.</p> : null}
      </div>

      <div css={css`display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;`}>
        <DsField css={css`margin: 0;`}>
          <DsLabel htmlFor={`price-${draft.id}`}>Price</DsLabel>
          <DsInput id={`price-${draft.id}`} inputMode="decimal" value={draft.priceInput} placeholder="25" onChange={event => set({ priceInput: event.target.value })} aria-invalid={!priceOk && draft.priceInput ? true : undefined} />
        </DsField>
        <DsField css={css`margin: 0;`}>
          <DsLabel htmlFor={`currency-${draft.id}`}>Currency</DsLabel>
          <select
            id={`currency-${draft.id}`}
            value={draft.currency}
            onChange={event => set({ currency: event.target.value })}
            css={css`width: 100%; font: inherit; font-size: 0.875rem; padding: 0.55rem 0.6rem; border-radius: 6px; border: 1px solid var(--border); background: var(--grey-1); color: var(--grey-4);`}
          >
            {Object.entries(CURRENCIES).map(([code, info]) => (
              <option key={code} value={code} disabled={!currencies.includes(code)}>
                {info.label}
              </option>
            ))}
          </select>
        </DsField>
        {draft.kind === 'physical' ? (
          <DsField css={css`margin: 0;`}>
            <DsLabel htmlFor={`ship-${draft.id}`} hint="Flat, per order. Empty = free">Shipping</DsLabel>
            <DsInput id={`ship-${draft.id}`} inputMode="decimal" value={draft.shippingInput} placeholder="0" onChange={event => set({ shippingInput: event.target.value })} />
          </DsField>
        ) : null}
      </div>

      {draft.kind === 'digital' ? (
        <DsField css={css`margin: 0;`}>
          <DsLabel htmlFor={`delivery-${draft.id}`} hint={draft.hasDelivery ? 'A link is saved. Paste a new one to replace it, or leave empty to keep it.' : 'Shown to the buyer right after they pay (a Google Drive, Dropbox or Notion link…). Leave empty to send it yourself.'}>
            Download link
          </DsLabel>
          <DsInput id={`delivery-${draft.id}`} type="url" value={draft.deliveryInput || ''} placeholder="https://" onChange={event => set({ deliveryInput: event.target.value, clearDelivery: false })} />
          {draft.hasDelivery && !draft.clearDelivery ? (
            <button type="button" onClick={() => set({ deliveryInput: '', clearDelivery: true })} css={css`margin-top: 0.4rem; border: 0; background: none; padding: 0; font: inherit; font-size: 0.75rem; color: #dc2626;`}>
              Remove the saved link
            </button>
          ) : null}
          {draft.clearDelivery ? <p css={[helpText, css`margin-top: 0.4rem;`]}>The link is removed when you save.</p> : null}
        </DsField>
      ) : null}

      <OptionsEditor kind="color" options={draft.colors} images={draft.images} onChange={colors => set({ colors })} />
      <OptionsEditor kind="size" options={draft.sizes} images={draft.images} onChange={sizes => set({ sizes })} />

      <div css={css`display: flex; flex-wrap: wrap; gap: 1.25rem;`}>
        <DsSwitch checked={draft.active !== false} onChange={active => set({ active })} label="Show in shop" />
        <DsSwitch checked={draft.soldOut === true} onChange={soldOut => set({ soldOut })} label="Sold out" />
      </div>

      <div css={css`display: flex; gap: 0.5rem; justify-content: space-between; flex-wrap: wrap;`}>
        <DsButton variant="ghost" onClick={onDelete} css={css`color: #dc2626;`}>Delete product</DsButton>
        <DsButton variant="outline" onClick={onClose}>Done</DsButton>
      </div>
    </div>
  )
}

function ProductsEditor({ user, provider, username }) {
  const [drafts, setDrafts] = useState(() => (user.shop?.products || []).map(p => toDraft({ ...p, hasDelivery: Boolean(p.deliverySealed) })))
  const [openId, setOpenId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const update = (id, next) => {
    setDrafts(list => list.map(d => (d.id === id ? next : d)))
    setDirty(true)
  }

  const add = () => {
    const draft = emptyProduct(drafts[drafts.length - 1]?.currency)
    if (provider === 'creem') draft.kind = 'digital'
    setDrafts(list => [...list, draft])
    setOpenId(draft.id)
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const products = drafts.map(fromDraft)
      const bad = products.find(p => !p.title.trim() || p.price == null)
      if (bad) throw new Error(`“${bad.title || 'A product'}” needs a name and a price.`)
      const deliveryLinks = {}
      for (const d of drafts) {
        if (d.clearDelivery) deliveryLinks[d.id] = ''
        else if (d.kind === 'digital' && typeof d.deliveryInput === 'string' && d.deliveryInput.trim()) deliveryLinks[d.id] = d.deliveryInput.trim()
      }
      const response = await authedFetch('/api/shop/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, deliveryLinks }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save')
      setDrafts(data.products.map(toDraft))
      setDirty(false)
      setMessage({ type: 'success', text: 'Saved. Your shop is up to date.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  // Warn before leaving with unsaved products.
  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = event => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const preview = useMemo(() => publicProducts({ products: drafts.map(fromDraft).filter(p => p.title && p.price != null) }), [drafts])

  return (
    <>
      <DsSection
        title="Products"
        description={`Unlimited sales, no fees from Bublr. Up to ${MAX_PRODUCTS} products.`}
        action={
          <div css={css`display: flex; gap: 0.5rem; align-items: center;`}>
            {dirty ? <span css={css`font-size: 0.75rem; color: var(--grey-3);`}>Unsaved changes</span> : null}
            <DsButton size="sm" variant="accent" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</DsButton>
          </div>
        }
      >
        {message ? <p role="status" css={[noticeStyle(message.type), css`margin-bottom: 0.9rem;`]}>{message.text}</p> : null}
        <DsTray>
          {drafts.map((draft, index) => (
            <DsTile key={draft.id}>
              {openId === draft.id ? (
                <ProductForm
                  draft={draft}
                  provider={provider}
                  onChange={next => update(draft.id, next)}
                  onClose={() => setOpenId(null)}
                  onDelete={() => {
                    setDrafts(list => list.filter(d => d.id !== draft.id))
                    setOpenId(null)
                    setDirty(true)
                  }}
                />
              ) : (
                <div css={css`display: flex; align-items: center; gap: 0.75rem;`}>
                  <div css={css`width: 44px; height: 44px; border-radius: 6px; overflow: hidden; background: var(--accent-bg-strong); flex-shrink: 0; border: 1px solid var(--border);`}>
                    {draft.images[0] ? <img src={draft.images[0]} alt="" css={css`width: 100%; height: 100%; object-fit: contain;`} /> : null}
                  </div>
                  <button type="button" onClick={() => setOpenId(draft.id)} css={css`flex: 1; min-width: 0; border: 0; background: none; font: inherit; text-align: left; color: var(--grey-4); display: flex; flex-direction: column; gap: 0.1rem;`}>
                    <span css={css`font-size: 0.88rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`}>{draft.title || 'Untitled product'}</span>
                    <span css={css`font-size: 0.75rem; color: var(--grey-3);`}>
                      {parsePriceInput(draft.priceInput) != null ? formatPrice(parsePriceInput(draft.priceInput), draft.currency) : 'No price yet'}
                      {draft.kind === 'digital' ? ' · Digital' : ''}
                      {draft.active === false ? ' · Hidden' : ''}
                      {draft.soldOut ? ' · Sold out' : ''}
                    </span>
                  </button>
                  <button type="button" css={iconButton} disabled={index === 0} aria-label="Move up" onClick={() => { setDrafts(l => moveItem(l, index, index - 1)); setDirty(true) }}>↑</button>
                  <button type="button" css={iconButton} disabled={index === drafts.length - 1} aria-label="Move down" onClick={() => { setDrafts(l => moveItem(l, index, index + 1)); setDirty(true) }}>↓</button>
                  <DsButton size="sm" variant="outline" onClick={() => setOpenId(draft.id)}>Edit</DsButton>
                </div>
              )}
            </DsTile>
          ))}
          <DsTile>
            <div css={css`display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;`}>
              <span css={helpText}>{drafts.length ? 'Add another product.' : 'Add your first product.'}</span>
              <DsButton size="sm" variant="outline" disabled={drafts.length >= MAX_PRODUCTS} onClick={add}>+ New product</DsButton>
            </div>
          </DsTile>
        </DsTray>
      </DsSection>

      <DsSection
        title="Preview"
        description="How the shop looks on your profile. Save to publish changes."
        action={username ? <DsButton size="sm" variant="outline" href={`/${username}#shop`} target="_blank" rel="noreferrer">View profile</DsButton> : null}
      >
        <div css={previewFrame}>
          {preview.length ? <ShopGrid products={preview} username={username} /> : <p css={helpText}>Products you add show up here.</p>}
        </div>
      </DsSection>
    </>
  )
}

// ------------------------------------------------------------ orders

function OrdersList() {
  const [orders, setOrders] = useState(null)
  useEffect(() => {
    authedFetch('/api/shop/orders')
      .then(r => r.json())
      .then(data => setOrders(data.orders || []))
      .catch(() => setOrders([]))
  }, [])

  if (!orders) return <p css={helpText}>Loading…</p>
  if (!orders.length) return <p css={helpText}>No orders yet. When someone buys, it shows up here and you get an email.</p>

  return (
    <DsTray>
      {orders.map(order => {
        const address = order.buyer?.address
        return (
          <DsTile key={order.id}>
            <div css={css`display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; font-size: 0.82rem; color: var(--grey-4);`}>
              <div css={css`display: flex; flex-direction: column; gap: 0.2rem; min-width: 0;`}>
                <strong css={css`font-weight: 500;`}>
                  {order.productTitle}
                  {order.variant ? ` (${order.variant})` : ''}
                </strong>
                <span css={css`color: var(--grey-3);`}>
                  {[order.buyer?.name, order.buyer?.email].filter(Boolean).join(' · ')}
                  {order.buyer?.phone ? ` · ${order.buyer.phone}` : ''}
                </span>
                {address ? (
                  <span css={css`color: var(--grey-3);`}>
                    {[address.line1, address.line2, [address.postal_code, address.city].filter(Boolean).join(' '), address.state, address.country].filter(Boolean).join(', ')}
                  </span>
                ) : null}
              </div>
              <div css={css`text-align: right; display: flex; flex-direction: column; gap: 0.2rem;`}>
                <span>{Number.isFinite(order.amount) ? formatPrice(order.amount, order.currency) : ''}</span>
                <span css={css`color: var(--grey-3); font-size: 0.75rem;`}>
                  {new Date(order.paidAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}
                  {PROVIDERS[order.provider]?.name}
                  {order.mode === 'test' ? ' (test)' : ''}
                </span>
              </div>
            </div>
          </DsTile>
        )
      })}
    </DsTray>
  )
}

// ------------------------------------------------------------ page

function ShopEditor({ user, authUser }) {
  const [title, setTitle] = useState(user.shopSectionTitle || '')
  const [payments, setPayments] = useState(null)
  const shopOpen = shopIsOpen(user)

  useEffect(() => {
    const value = title.trim().slice(0, 40)
    if (value === (user.shopSectionTitle || '')) return undefined
    const timer = setTimeout(() => {
      firestore.collection('users').doc(user.id).update({ shopSectionTitle: value }).catch(() => {})
    }, 700)
    return () => clearTimeout(timer)
  }, [title]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!shopOpen) {
    return (
      <>
        <PlanGate user={user} authUser={authUser} />
        {(user.shopOrders || []).length ? (
          <DsSection title="Past orders">
            <OrdersList />
          </DsSection>
        ) : null}
      </>
    )
  }

  return (
    <>
      <BlockStyles />
      <DsSection title="Shop" description="Your shop sits on your profile. Buyers pay you directly; Bublr never touches the money.">
        <DsField css={css`margin: 0; max-width: 360px;`}>
          <DsLabel htmlFor="shop-title">Section title</DsLabel>
          <DsInput id="shop-title" value={title} placeholder="Shop" maxLength={40} onChange={event => setTitle(event.target.value)} />
        </DsField>
      </DsSection>
      <DsSection title="Payments" description="Connect your own payment account. Every sale goes straight to it.">
        <PaymentsPanel onChange={setPayments} />
      </DsSection>
      <ProductsEditor user={user} provider={payments?.provider || null} username={user.name} />
      <DsSection title="Orders">
        <OrdersList />
      </DsSection>
    </>
  )
}

function ShopSettings() {
  const { user, authUser, loading } = useCurrentUserDoc()
  return (
    <BlockSettingsPage title="Shop">
      <LoadingContainer isLoading={loading || !user}>{user ? <ShopEditor key={shopIsOpen(user) ? 'open' : 'closed'} user={user} authUser={authUser} /> : null}</LoadingContainer>
    </BlockSettingsPage>
  )
}

export default withBlockLayout(ShopSettings, 'Shop')
