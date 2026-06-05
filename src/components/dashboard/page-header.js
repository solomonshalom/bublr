/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

const headerStyle = css`
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--page-header-height);
  padding: 0 1.25rem;
  background: var(--muted);
  border-bottom: 1px dashed var(--border-dashed);
  font-family: 'Inter', sans-serif;
`

const leftStyle = css`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
`

const sidebarToggleStyle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--grey-3);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent-foreground);
    border-color: var(--accent-border);
  }
`

const titleStyle = css`
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--grey-5);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const actionsStyle = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const PanelLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
)

export default function PageHeader({ title, actions, onToggleSidebar }) {
  return (
    <header css={headerStyle}>
      <div css={leftStyle}>
        {onToggleSidebar && (
          <button
            type="button"
            css={sidebarToggleStyle}
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            title="Toggle sidebar (⌘B)"
          >
            <PanelLeftIcon />
          </button>
        )}
        <h2 css={titleStyle}>{title}</h2>
      </div>
      {actions && <div css={actionsStyle}>{actions}</div>}
    </header>
  )
}
