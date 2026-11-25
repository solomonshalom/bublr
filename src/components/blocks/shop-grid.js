/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useRouter } from 'next/router'

import HoverSlideList from './hover-slide-list'
import { EASE, blockTokens, vtName } from './tokens'
import { transitionClick } from './vt-navigation'

/**
 * The shop grid on a profile, ported from supply-page.tsx on jeremybosma.nl
 * (github.com/jeremybosma/jeremybosma, by Jeremy Bosma): square photos on a
 * soft tile, the name under each, a sliding hover highlight, and a photo that
 * grows into the product page.
 */

export function productHref(username, productId, onCustomDomain) {
  return onCustomDomain ? `/shop/${productId}` : `/${username}/shop/${productId}`
}

export default function ShopGrid({ products, username, onCustomDomain = false }) {
  const router = useRouter()
  if (!products?.length) return null

  return (
    <div css={[blockTokens, css`container-type: inline-size; container-name: blk; margin-top: 16px;`]}>
      <HoverSlideList
        css={css`
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin: 0 -12px;
          @container blk (min-width: 420px) {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
          }
        `}
      >
        {products.map(product => {
          const href = productHref(username, product.id, onCustomDomain)
          const image = product.images?.[0] || null
          return (
            <a
              key={product.id}
              href={href}
              onClick={transitionClick(router, href)}
              className="hover-slide-item"
              aria-label={`View ${product.title} product details`}
              css={css`
                display: block;
                border-radius: 10px;
                padding: 12px;
              `}
            >
              <div
                css={css`
                  aspect-ratio: 1 / 1;
                  position: relative;
                  overflow: hidden;
                  border-radius: 6px;
                  margin-bottom: 8px;
                  background: var(--blk-secondary);
                `}
              >
                {image ? (
                  <img
                    src={image}
                    alt={`${product.title} product image`}
                    loading="lazy"
                    style={{ viewTransitionName: vtName('shop-image', product.id) }}
                    css={css`
                      position: absolute;
                      inset: 0;
                      width: 100%;
                      height: 100%;
                      object-fit: contain;
                      transition: transform 0.3s ${EASE};
                      .hover-slide-item:hover & {
                        transform: scale(1.05);
                      }
                      @media (prefers-reduced-motion: reduce) {
                        transition: none;
                      }
                    `}
                  />
                ) : (
                  <div css={css`position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--blk-muted);`}>
                    No image
                  </div>
                )}
              </div>
              <p
                className="hover-slide-title hover-slide-muted"
                style={{ viewTransitionName: vtName('shop-title', product.id) }}
                css={css`
                  font-size: 12px;
                  line-height: 1.35;
                  text-align: center !important;
                  color: var(--blk-muted);
                  width: fit-content;
                  margin: 0 auto !important;
                `}
              >
                {product.title}
              </p>
            </a>
          )
        })}
      </HoverSlideList>
    </div>
  )
}
