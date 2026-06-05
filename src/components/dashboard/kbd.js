/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

const kbdStyle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  font-weight: 500;
  line-height: 1;
  color: var(--grey-3);
  background: var(--accent-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  letter-spacing: 0.02em;
`

export default function Kbd({ children, ...rest }) {
  return (
    <kbd css={kbdStyle} {...rest}>
      {children}
    </kbd>
  )
}
