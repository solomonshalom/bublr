/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import { css } from '@emotion/react'

const buttonStyles = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1;
  border: 1px solid var(--grey-5);
  outline: none;
  cursor: pointer;
  padding: 0.55rem 0.95rem;
  background: var(--grey-5);
  color: var(--grey-1);
  border-radius: 6px;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 80ms ease;
  user-select: none;

  &:hover:not(:disabled) {
    background: var(--grey-4);
    border-color: var(--grey-4);
  }

  &:focus-visible {
    box-shadow: 0 0 0 3px var(--accent-soft);
    border-color: var(--accent-border);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`

const outlineButtonStyles = css`
  ${buttonStyles};

  background: var(--grey-1);
  color: var(--grey-4);
  border: 1px solid var(--border);

  &:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent-foreground);
    border-color: var(--accent-border);
  }

  &:disabled {
    background: var(--grey-1);
    color: var(--grey-3);
    border-color: var(--border);
  }
`

export default function Button(props) {
  if (props.outline) {
    let { outline, ...rest } = props

    return (
      <button css={outlineButtonStyles} {...rest}>
        {props.children}
      </button>
    )
  }
  return (
    <button css={buttonStyles} {...props}>
      {props.children}
    </button>
  )
}

export function LinkButton(props) {
  if (props.outline) {
    let { outline, ...rest } = props

    return (
      <Link {...rest}>
        <a
          css={css`
            ${outlineButtonStyles};
            text-decoration: none;
          `}
        >
          {props.children}
        </a>
      </Link>
    )
  }
  return (
    <Link {...props}>
      <a
        css={css`
          ${buttonStyles};
          text-decoration: none;
        `}
      >
        {props.children}
      </a>
    </Link>
  )
}

const iconButtonStyles = css`
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 2.1rem;
  height: 2.1rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--grey-3);
  font-family: 'Inter', sans-serif;
  font-size: 1.05rem;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;

  &:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent-foreground);
    border-color: var(--accent-border);
  }

  &:disabled {
    background: transparent;
    cursor: not-allowed;
    opacity: 0.45;
  }
`

export function IconButton(props) {
  return (
    <button
      css={css`
        ${iconButtonStyles}
      `}
      {...props}
    >
      {props.children}
    </button>
  )
}

export function LinkIconButton(props) {
  return (
    <Link {...props}>
      <a
        css={css`
          ${iconButtonStyles};
          color: inherit;
          text-decoration: none;
        `}
        {...props}
      >
        {props.children}
      </a>
    </Link>
  )
}
