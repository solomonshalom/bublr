/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

const sectionStyle = css`
  margin: 0 0 2rem 0;
  padding-top: 1.75rem;
  border-top: 1px dashed var(--border-dashed);

  &:first-of-type {
    padding-top: 0;
    border-top: none;
  }
`

const headerStyle = css`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
`

const titleStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--grey-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
`

const descriptionStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  color: var(--grey-3);
  margin: -0.55rem 0 1.1rem 0;
  line-height: 1.5;
`

const cardStyle = css`
  background: var(--accent-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.1rem;
`

const dashedCardStyle = css`
  background: var(--accent-bg);
  border: 1px dashed var(--border-dashed);
  border-radius: 8px;
  padding: 1rem 1.1rem;
`

/* Chord.so layered surface — outer "tray" houses inner "tiles" with concentric radii */
const trayStyle = css`
  background: var(--accent-bg-strong);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`

const tileStyle = css`
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 0.85rem 1rem;
  box-shadow: var(--chord-shadow-sm);
  transition: border-color 150ms ease, background 150ms ease;
`

const tileHoverableStyle = css`
  cursor: pointer;

  &:hover {
    border-color: var(--grey-3);
    background: var(--accent-bg-strong);
  }
`

const inlineRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
`

export function DsSection({ title, description, action, children, ...rest }) {
  return (
    <section css={sectionStyle} {...rest}>
      {(title || action) && (
        <div css={headerStyle}>
          {title && <h3 css={titleStyle}>{title}</h3>}
          {action}
        </div>
      )}
      {description && <p css={descriptionStyle}>{description}</p>}
      {children}
    </section>
  )
}

export function DsCard({ children, dashed, ...rest }) {
  return (
    <div css={dashed ? dashedCardStyle : cardStyle} {...rest}>
      {children}
    </div>
  )
}

export function DsInlineRow({ children, ...rest }) {
  return (
    <div css={inlineRowStyle} {...rest}>
      {children}
    </div>
  )
}

/* Chord.so tray: outer container that holds DsTile children at a concentric inner radius */
export function DsTray({ children, ...rest }) {
  return (
    <div css={trayStyle} {...rest}>
      {children}
    </div>
  )
}

/* Chord.so tile: inner card with the signature small-shadow, sits inside a DsTray */
export function DsTile({ children, hoverable, as: Component = 'div', ...rest }) {
  return (
    <Component css={[tileStyle, hoverable && tileHoverableStyle]} {...rest}>
      {children}
    </Component>
  )
}
