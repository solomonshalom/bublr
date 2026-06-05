/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

const inputStyles = css`
  display: block;
  width: 100%;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--grey-4);
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.55rem 0.75rem;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;

  &::placeholder {
    color: var(--grey-3);
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: var(--grey-3);
  }

  &:focus {
    border-color: var(--accent-border);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`

const Input = props => (
  <input
    {...props}
    css={css`
      ${inputStyles}
    `}
  />
)

export const Textarea = props => (
  <textarea
    {...props}
    css={css`
      ${inputStyles}
      min-height: 8rem;
      resize: vertical;
      padding-top: 0.65rem;
      line-height: 1.55;
    `}
  />
)

export default Input
