/** @jsxImportSource @emotion/react */
import { css, ClassNames } from '@emotion/react'

const baseInputStyle = css`
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

  &:hover:not(:disabled):not(:focus) {
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

const textareaStyle = css`
  ${baseInputStyle};
  min-height: 6rem;
  resize: vertical;
  line-height: 1.55;
`

const labelStyle = css`
  display: block;
  margin-bottom: 0.4rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--grey-4);
  line-height: 1.4;
`

const labelHintStyle = css`
  display: block;
  margin-top: 0.15rem;
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--grey-3);
`

const fieldGroupStyle = css`
  margin-bottom: 1.1rem;
`

export function DsInput(props) {
  // ClassNames lets us pass a stable className AND merge an optional className
  return (
    <ClassNames>
      {({ css: cn, cx }) => (
        <input
          {...props}
          className={cx(cn(baseInputStyle), props.className)}
        />
      )}
    </ClassNames>
  )
}

export function DsTextarea(props) {
  return (
    <ClassNames>
      {({ css: cn, cx }) => (
        <textarea
          {...props}
          className={cx(cn(textareaStyle), props.className)}
        />
      )}
    </ClassNames>
  )
}

export function DsLabel({ children, hint, htmlFor, ...rest }) {
  return (
    <label htmlFor={htmlFor} css={labelStyle} {...rest}>
      {children}
      {hint && <span css={labelHintStyle}>{hint}</span>}
    </label>
  )
}

export function DsField({ children, ...rest }) {
  return (
    <div css={fieldGroupStyle} {...rest}>
      {children}
    </div>
  )
}
