/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import { css } from '@emotion/react'

import meta from '../meta'
import { safeJsonLd } from '../../lib/escape'
import { formatPrice } from '../../lib/shop'
import ProductDetail from './product-detail'
import { BlockStyles } from './tokens'

/** The whole product page: head tags, structured data and the product. */
export default function ProductPage({ product, username, writer, paymentsReady, testMode = false, ownerId = null, onCustomDomain }) {
  const url = onCustomDomain ? `/shop/${product.id}` : `/${username}/shop/${product.id}`
  const description =
    (product.description || '').slice(0, 155) ||
    `${product.title}, ${formatPrice(product.price, product.currency)}, from ${writer.displayName}'s shop on Bublr.`

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description || undefined,
    image: product.images?.length ? product.images : undefined,
    brand: { '@type': 'Person', name: writer.displayName },
    offers: {
      '@type': 'Offer',
      price: (product.price / 100).toFixed(2),
      priceCurrency: String(product.currency || 'usd').toUpperCase(),
      availability: product.soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  }

  return (
    <>
      <Head>
        {meta({
          title: `${product.title} | ${writer.displayName}`,
          description,
          url,
          image: product.images?.[0] || writer.photo,
        })}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      </Head>
      <BlockStyles />
      <main
        css={css`
          min-height: 100vh;
          background: var(--grey-1);
          font-family: Inter, sans-serif;
          -webkit-font-smoothing: antialiased;
          padding: 24px 16px 64px;
          @media (min-width: 768px) {
            padding: 48px 32px 96px;
          }
        `}
      >
        <div css={css`max-width: 880px; margin: 0 auto;`}>
          <ProductDetail
            product={product}
            username={username}
            writerName={writer.displayName}
            onCustomDomain={onCustomDomain}
            paymentsReady={paymentsReady}
            testMode={testMode}
            ownerId={ownerId}
          />
        </div>
      </main>
    </>
  )
}
