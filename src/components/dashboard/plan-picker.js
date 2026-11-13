/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

import { PLANS, formatUsd, yearlySavings } from '../../lib/plans'

/**
 * PlanPicker — choose between the monthly and yearly custom domain plans.
 *
 * Real radio buttons (so arrow keys and screen readers work) drawn as the
 * same tiles the rest of the dashboard uses; the chosen one takes the iris
 * "active" treatment from the sidebar nav. Prices and the saving come from
 * lib/plans.js.
 *
 * Props:
 *   intervals — which plans to offer, e.g. ['month', 'year']
 *   value     — the chosen interval
 *   onChange  — (interval) => void
 *   disabled  — boolean
 *   name      — radio group name (only matters with two pickers on a page)
 */

const groupStyle = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11.5rem, 1fr));
  gap: 0.4rem;
  border: none;
  margin: 0;
  padding: 0;
  min-width: 0;
`

const visuallyHidden = css`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`

const optionStyle = css`
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  background: var(--grey-1);
  border: 1px solid var(--border);
  border-radius: 7px;
  box-shadow: var(--chord-shadow-sm);
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;

  &:hover {
    border-color: var(--grey-3);
  }

  /* Keyboard focus ring, same as DsInput / DsButton */
  input:focus-visible + span {
    box-shadow: 0 0 0 3px var(--accent-soft);
    border-color: var(--accent-border);
  }
`

const optionSelectedStyle = css`
  /* accent-soft is translucent, so it sits on the tile's own surface colour */
  background: linear-gradient(var(--accent-soft), var(--accent-soft)), var(--grey-1);
  border-color: var(--accent-border);

  &:hover {
    border-color: var(--accent-border);
  }
`

const optionDisabledStyle = css`
  opacity: 0.55;
  cursor: not-allowed;

  &:hover {
    border-color: var(--border);
  }
`

// Sits right after the hidden <input> so it can draw the focus ring
const focusFrameStyle = css`
  position: absolute;
  inset: -1px;
  border: 1px solid transparent;
  border-radius: 7px;
  pointer-events: none;
  transition: box-shadow 150ms ease, border-color 150ms ease;
`

const dotStyle = css`
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin-top: 0.22rem;
  border-radius: 50%;
  border: 1px solid var(--grey-2);
  background: var(--grey-1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 150ms ease;

  /* --grey-2 all but disappears against a dark tile */
  [data-theme='dark'] & {
    border-color: var(--grey-3);
  }
`

const dotSelectedStyle = css`
  border-color: var(--accent);

  [data-theme='dark'] & {
    border-color: var(--accent);
  }

  &::after {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }
`

const bodyStyle = css`
  min-width: 0;
  flex: 1;
`

const nameRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  /* Tall enough for the "Save" badge, so both tiles' names sit on one line */
  min-height: 1.4rem;
`

const nameStyle = css`
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--grey-4);
`

const nameSelectedStyle = css`
  color: var(--accent-foreground);
`

const saveBadgeStyle = css`
  flex-shrink: 0;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  border: 1px solid var(--accent-border);
  background: var(--accent-soft-strong);
  color: var(--accent-foreground);
  font-size: 0.65rem;
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: 0.02em;
  white-space: nowrap;
`

const priceRowStyle = css`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.35rem;
`

const priceStyle = css`
  font-size: 1.35rem;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--grey-5);
`

const perStyle = css`
  font-size: 0.75rem;
  color: var(--grey-3);
`

const wasStyle = css`
  margin-left: 0.2rem;
  font-size: 0.75rem;
  color: var(--grey-3);
  text-decoration: line-through;
`

const noteStyle = css`
  margin: 0.35rem 0 0 0;
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--grey-3);
`

export default function PlanPicker({
  intervals = ['month', 'year'],
  value,
  onChange,
  disabled = false,
  name = 'custom-domain-plan',
}) {
  const savings = yearlySavings()
  const offered = intervals.filter(interval => PLANS[interval])
  // The saving is only worth claiming next to the monthly price it's measured against
  const showSavings = offered.includes('month') && savings.amount > 0

  return (
    <fieldset css={groupStyle}>
      <legend css={visuallyHidden}>Billing</legend>
      {offered.map(interval => {
        const plan = PLANS[interval]
        const selected = value === interval
        const yearly = interval === 'year'

        return (
          <label
            key={interval}
            css={[optionStyle, selected && optionSelectedStyle, disabled && optionDisabledStyle]}
          >
            <input
              type="radio"
              name={name}
              value={interval}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange?.(interval)}
              css={visuallyHidden}
            />
            <span css={focusFrameStyle} aria-hidden="true" />
            <span css={[dotStyle, selected && dotSelectedStyle]} aria-hidden="true" />

            <span css={bodyStyle}>
              <span css={nameRowStyle}>
                <span css={[nameStyle, selected && nameSelectedStyle]}>{plan.label}</span>
                {yearly && showSavings && (
                  <span css={saveBadgeStyle}>Save {savings.percent}%</span>
                )}
              </span>

              <span css={priceRowStyle}>
                <span css={priceStyle}>{formatUsd(plan.price)}</span>
                <span css={perStyle}>/{plan.per}</span>
                {yearly && showSavings && (
                  <span css={wasStyle}>
                    <span css={visuallyHidden}>instead of </span>
                    {formatUsd(savings.twelveMonths)}
                  </span>
                )}
              </span>

              <span css={[noteStyle, css`display: block;`]}>
                {yearly
                  ? `${formatUsd(savings.perMonth)} a month, billed once a year`
                  : 'Billed every month'}
              </span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
