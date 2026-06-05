/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

const baseStyle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  border-radius: 6px;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 80ms ease;
  user-select: none;
  position: relative;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
    border-color: var(--accent-border);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  svg {
    flex-shrink: 0;
  }
`

const sizes = {
  sm: css`
    font-size: 0.75rem;
    padding: 0.35rem 0.65rem;
    height: 1.75rem;
  `,
  default: css`
    font-size: 0.825rem;
    padding: 0.45rem 0.85rem;
    height: 2.1rem;
  `,
  lg: css`
    font-size: 0.9rem;
    padding: 0.6rem 1.1rem;
    height: 2.5rem;
  `,
  icon: css`
    width: 2.1rem;
    height: 2.1rem;
    padding: 0;
  `,
}

const variants = {
  // Primary — solid dark (chord.so signature: bordered with 2px bottom for depth)
  default: css`
    background: var(--grey-5);
    color: var(--grey-1);
    border: 1px solid var(--grey-5);
    border-bottom-width: 2px;
    box-shadow: var(--chord-shadow-sm);

    &:hover:not(:disabled) {
      background: var(--grey-4);
      border-color: var(--grey-4);
    }

    &:active:not(:disabled) {
      border-bottom-width: 1px;
      padding-top: calc(0.45rem + 1px);
    }
  `,

  // Outline — neutral border, accent on hover (chord secondary feel)
  outline: css`
    background: var(--grey-1);
    color: var(--grey-4);
    border: 1px solid var(--border);
    border-bottom-width: 2px;

    &:hover:not(:disabled) {
      background: var(--accent-bg-strong);
      border-color: var(--grey-3);
    }

    &:active:not(:disabled) {
      border-bottom-width: 1px;
      padding-top: calc(0.45rem + 1px);
    }
  `,

  // Ghost — no border, hover bg
  ghost: css`
    background: transparent;
    color: var(--grey-4);
    border: 1px solid transparent;

    &:hover:not(:disabled) {
      background: var(--accent-soft);
      color: var(--accent-foreground);
    }
  `,

  // Secondary — muted fill, neutral
  secondary: css`
    background: var(--accent-bg-strong);
    color: var(--grey-4);
    border: 1px solid var(--border);
    border-bottom-width: 2px;

    &:hover:not(:disabled) {
      background: var(--accent-soft);
      color: var(--accent-foreground);
      border-color: var(--accent-border);
    }

    &:active:not(:disabled) {
      border-bottom-width: 1px;
      padding-top: calc(0.45rem + 1px);
    }
  `,

  // Accent — iris-tinted action button (formerly the default)
  accent: css`
    background: var(--accent);
    color: white;
    border: 1px solid var(--accent);
    border-bottom-width: 2px;
    box-shadow: var(--chord-shadow-sm);

    &:hover:not(:disabled) {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }

    &:active:not(:disabled) {
      border-bottom-width: 1px;
      padding-top: calc(0.45rem + 1px);
    }
  `,

  // Destructive — red for destructive actions
  destructive: css`
    background: transparent;
    color: #e5484d;
    border: 1px dashed rgba(229, 72, 77, 0.45);

    &:hover:not(:disabled) {
      background: rgba(229, 72, 77, 0.08);
      border-style: solid;
      border-color: rgba(229, 72, 77, 0.7);
    }
  `,

  // Link — text-only, accent
  link: css`
    background: transparent;
    color: var(--accent-foreground);
    border: 1px solid transparent;
    padding-left: 0;
    padding-right: 0;
    height: auto;

    &:hover:not(:disabled) {
      text-decoration: underline;
    }
  `,
}

export default function DsButton({
  variant = 'default',
  size = 'default',
  type = 'button',
  href,
  children,
  ...rest
}) {
  const composedCss = [baseStyle, sizes[size] || sizes.default, variants[variant] || variants.default]

  // Chord-style polymorphism: render an <a> when href is provided, button otherwise
  if (href !== undefined) {
    return (
      <a
        href={href}
        css={[composedCss, css`text-decoration: none;`]}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type={type}
      css={composedCss}
      {...rest}
    >
      {children}
    </button>
  )
}
