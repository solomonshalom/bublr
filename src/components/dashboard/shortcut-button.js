/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

const buttonStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.825rem;
  font-weight: 500;
  color: var(--grey-4);
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.45rem 0.75rem 0.45rem 0.45rem;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent-foreground);
    border-color: var(--accent-border);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
    border-color: var(--accent-border);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover .letter-chip {
    color: var(--accent-foreground);
    border-color: var(--accent-border);
    background: var(--accent-soft-strong);
  }
`

const letterChipStyle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
  padding: 0;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  color: var(--grey-4);
  background: var(--accent-bg-strong);
  border: 1px solid var(--border);
  border-radius: 4px;
  line-height: 1;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
`

export default function ShortcutButton({ letter, label, onClick, disabled, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      css={buttonStyle}
      {...rest}
    >
      <span className="letter-chip" css={letterChipStyle}>{letter}</span>
      {label}
    </button>
  )
}
