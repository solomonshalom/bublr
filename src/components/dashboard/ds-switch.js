/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

/**
 * DsSwitch — Chord-style toggle.
 * Off: neutral grey track + white thumb.
 * On:  green track + light thumb.
 * Same size and behavior everywhere it's used.
 *
 * Props:
 *   checked  — boolean
 *   onChange — (next: boolean) => void
 *   label    — optional text to render after the switch
 *   size     — 'sm' | 'default' (default ≈ Chord's h-4 w-7)
 *   disabled — boolean
 */

const labelRowStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  cursor: pointer;
  user-select: none;
  font-family: 'Inter', sans-serif;
  font-size: 0.825rem;
  color: var(--grey-4);
`

const sizes = {
  sm: { track: { w: 24, h: 14 }, thumb: 10 },
  default: { track: { w: 32, h: 18 }, thumb: 14 },
}

function trackStyle(size, checked, disabled) {
  return css`
    position: relative;
    display: inline-block;
    flex-shrink: 0;
    width: ${size.track.w}px;
    height: ${size.track.h}px;
    padding: 1px;
    border-radius: 9999px;
    border: 1px solid ${checked ? 'var(--green-border, #2b9a66)' : 'var(--border)'};
    background: ${checked
      ? 'var(--green, #30a46c)'
      : 'var(--accent-bg-strong)'};
    transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
    opacity: ${disabled ? 0.55 : 1};
    cursor: ${disabled ? 'not-allowed' : 'pointer'};
    box-sizing: border-box;

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px ${checked ? 'rgba(48, 164, 108, 0.25)' : 'var(--accent-soft)'};
      border-color: ${checked ? 'var(--green-border, #2b9a66)' : 'var(--accent-border)'};
    }
  `
}

function thumbStyle(size, checked) {
  const offset = size.track.w - size.thumb - 4 // 2px padding each side
  return css`
    position: absolute;
    top: 1px;
    left: 1px;
    width: ${size.thumb}px;
    height: ${size.thumb}px;
    border-radius: 50%;
    background: ${checked ? '#e6f6ec' : 'var(--grey-1)'};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    transform: translateX(${checked ? offset : 0}px);
    transition: transform 160ms cubic-bezier(0.32, 0.72, 0, 1), background-color 150ms ease;
  `
}

export default function DsSwitch({
  checked = false,
  onChange,
  label,
  size = 'default',
  disabled = false,
  id,
  ...rest
}) {
  const sz = sizes[size] || sizes.default

  const toggle = () => {
    if (disabled) return
    onChange?.(!checked)
  }

  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={toggle}
      id={id}
      css={trackStyle(sz, checked, disabled)}
      {...rest}
    >
      <span aria-hidden="true" css={thumbStyle(sz, checked)} />
    </button>
  )

  if (!label) return button

  return (
    <label css={labelRowStyle} onClick={toggle}>
      {button}
      <span>{label}</span>
    </label>
  )
}
