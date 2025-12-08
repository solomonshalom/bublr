/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon, CopyIcon, CheckIcon, EyeOpenIcon, EyeClosedIcon } from '@radix-ui/react-icons'
import Link from 'next/link'

import Spinner from './spinner'

const StyledLabel = props => (
  <label
    css={css`
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      color: var(--grey-3);
    `}
    {...props}
  >
    {props.children}
  </label>
)

function ApiKeyManager({ userId }) {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState(null)
  const [revoking, setRevoking] = useState(null)

  useEffect(() => {
    async function fetchKeys() {
      try {
        const res = await fetch(`/api/keys/list?userId=${userId}`)
        const data = await res.json()
        if (data.keys) {
          setKeys(data.keys)
        }
      } catch (err) {
        console.error('Error fetching API keys:', err)
        setError('Failed to load API keys')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchKeys()
    }
  }, [userId])

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      setError('Please enter a name for your API key')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/keys/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: newKeyName.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create API key')
        return
      }

      setNewlyCreatedKey(data.key)
      setKeys(prev => [...prev, data.metadata])
      setNewKeyName('')
    } catch (err) {
      console.error('Error creating API key:', err)
      setError('Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const handleRevokeKey = async (keyId) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return
    }

    setRevoking(keyId)
    setError(null)

    try {
      const res = await fetch('/api/keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, keyId })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to revoke API key')
        return
      }

      setKeys(prev => prev.filter(k => k.id !== keyId))
    } catch (err) {
      console.error('Error revoking API key:', err)
      setError('Failed to revoke API key')
    } finally {
      setRevoking(null)
    }
  }

  const handleCopyKey = async () => {
    if (!newlyCreatedKey) return

    try {
      await navigator.clipboard.writeText(newlyCreatedKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDismissNewKey = () => {
    setNewlyCreatedKey(null)
    setShowKey(false)
  }

  if (loading) {
    return (
      <div css={css`display: flex; justify-content: center; padding: 1.5rem;`}>
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <p css={css`
        font-size: 0.8rem;
        color: var(--grey-3);
        margin-bottom: 1.25rem;
        line-height: 1.6;
      `}>
        API keys let you access your Bublr data programmatically.{' '}
        <Link href="/docs">
          <a css={css`
            color: var(--grey-4);
            text-decoration: underline;
            text-underline-offset: 2px;
            &:hover { opacity: 0.8; }
          `}>
            View documentation
          </a>
        </Link>
      </p>

      {/* Newly created key display */}
      {newlyCreatedKey && (
        <div css={css`
          background: var(--grey-1);
          border: 2px solid var(--grey-3);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1.25rem;
        `}>
          <p css={css`
            margin: 0 0 0.5rem 0;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--grey-4);
          `}>
            API key created!
          </p>
          <p css={css`
            margin: 0 0 0.75rem 0;
            font-size: 0.75rem;
            color: var(--grey-3);
          `}>
            Copy this key now. You won&apos;t be able to see it again.
          </p>

          <div css={css`
            display: flex;
            gap: 0.5rem;
            align-items: center;
          `}>
            <code css={css`
              flex: 1;
              background: var(--grey-2);
              padding: 0.5rem 0.75rem;
              border-radius: 0.25rem;
              font-size: 0.7rem;
              word-break: break-all;
              color: var(--grey-4);
            `}>
              {showKey ? newlyCreatedKey : '••••••••••••••••••••••••••••••••••••••••'}
            </code>

            <button
              onClick={() => setShowKey(!showKey)}
              css={css`
                background: var(--grey-2);
                border: none;
                border-radius: 0.25rem;
                padding: 0.5rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                color: var(--grey-4);
                &:hover { background: var(--grey-3); color: var(--grey-1); }
              `}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
            </button>

            <button
              onClick={handleCopyKey}
              css={css`
                background: var(--grey-2);
                border: none;
                border-radius: 0.25rem;
                padding: 0.5rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                color: var(--grey-4);
                &:hover { background: var(--grey-3); color: var(--grey-1); }
              `}
              title="Copy to clipboard"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>

          <button
            onClick={handleDismissNewKey}
            css={css`
              margin-top: 0.75rem;
              font-size: 0.75rem;
              color: var(--grey-3);
              background: none;
              border: none;
              cursor: pointer;
              text-decoration: underline;
              &:hover { color: var(--grey-4); }
            `}
          >
            I&apos;ve copied the key
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p css={css`
          font-size: 0.8rem;
          color: #dc2626;
          margin-bottom: 1rem;
          padding: 0.5rem;
          background: #fef2f2;
          border-radius: 0.25rem;
        `}>
          {error}
        </p>
      )}

      {/* Create new key form */}
      <div css={css`margin-bottom: 1.25rem;`}>
        <StyledLabel htmlFor="api-key-name">Create New Key</StyledLabel>
        <div css={css`display: flex; gap: 0.5rem;`}>
          <input
            id="api-key-name"
            type="text"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., My App)"
            maxLength={50}
            disabled={creating || keys.length >= 5}
            css={css`
              flex: 1;
              padding: 0.5rem 0.75rem;
              font-size: 0.85rem;
              border: 1px solid var(--grey-2);
              border-radius: 0.5rem;
              background: transparent;
              color: var(--grey-4);

              &:focus {
                outline: none;
                border-color: var(--grey-3);
              }

              &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
              }

              &::placeholder {
                color: var(--grey-3);
              }
            `}
          />
          <button
            onClick={handleCreateKey}
            disabled={creating || !newKeyName.trim() || keys.length >= 5}
            css={css`
              background: var(--grey-5);
              color: var(--grey-1);
              border: none;
              padding: 0.5rem 0.75rem;
              border-radius: 0.5rem;
              font-size: 0.8rem;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 0.25rem;
              white-space: nowrap;
              opacity: ${creating || !newKeyName.trim() || keys.length >= 5 ? 0.5 : 1};

              &:hover:not(:disabled) {
                opacity: 0.8;
              }

              &:disabled {
                cursor: not-allowed;
              }
            `}
          >
            {creating ? 'Creating...' : <><PlusIcon width={14} height={14} /> Create</>}
          </button>
        </div>
        {keys.length >= 5 && (
          <p css={css`font-size: 0.7rem; color: var(--grey-3); margin-top: 0.5rem;`}>
            Maximum 5 keys. Revoke one to create a new key.
          </p>
        )}
      </div>

      {/* Existing keys list */}
      <div>
        <p css={css`
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--grey-3);
          margin: 0 0 0.5rem 0;
        `}>
          Your Keys ({keys.length}/5)
        </p>

        {keys.length === 0 ? (
          <p css={css`
            font-size: 0.8rem;
            color: var(--grey-3);
            text-align: center;
            padding: 1.5rem;
            background: var(--grey-1);
            border: 1px dashed var(--grey-2);
            border-radius: 0.5rem;
          `}>
            No API keys yet
          </p>
        ) : (
          <div css={css`display: flex; flex-direction: column; gap: 0.5rem;`}>
            {keys.map(key => (
              <div
                key={key.id}
                css={css`
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 0.6rem 0.75rem;
                  background: var(--grey-1);
                  border: 1px solid var(--grey-2);
                  border-radius: 0.5rem;
                  gap: 0.75rem;
                `}
              >
                <div css={css`min-width: 0; flex: 1;`}>
                  <p css={css`
                    margin: 0;
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--grey-4);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  `}>
                    {key.name}
                  </p>
                  <p css={css`
                    margin: 0.15rem 0 0 0;
                    font-size: 0.7rem;
                    color: var(--grey-3);
                    font-family: monospace;
                  `}>
                    {key.keyPrefix}
                  </p>
                </div>

                <button
                  onClick={() => handleRevokeKey(key.id)}
                  disabled={revoking === key.id}
                  css={css`
                    background: none;
                    color: var(--grey-3);
                    border: 1px solid var(--grey-2);
                    padding: 0.35rem 0.6rem;
                    border-radius: 0.375rem;
                    font-size: 0.7rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    flex-shrink: 0;
                    opacity: ${revoking === key.id ? 0.5 : 1};

                    &:hover:not(:disabled) {
                      border-color: #dc2626;
                      color: #dc2626;
                    }

                    &:disabled {
                      cursor: not-allowed;
                    }
                  `}
                >
                  <TrashIcon width={11} height={11} />
                  {revoking === key.id ? '...' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ApiKeySection({ userId }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div css={css`margin-top: 1.5rem;`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        css={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: none;
          padding: 0;
          font-size: 0.85rem;
          color: var(--grey-3);
          cursor: pointer;
          transition: color 0.15s ease;
          width: 100%;
          text-align: left;

          &:hover {
            color: var(--grey-4);
          }
        `}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7.07095 0.650238C6.67391 0.650238 6.32977 0.925096 6.24198 1.31231L6.0039 2.36247C5.6249 2.47269 5.26335 2.62363 4.92436 2.81013L4.01335 2.23585C3.67748 2.02413 3.23978 2.07312 2.95903 2.35386L2.35294 2.95996C2.0722 3.24071 2.0232 3.67841 2.23493 4.01427L2.80942 4.92561C2.62307 5.2645 2.47227 5.62594 2.36216 6.00481L1.31209 6.24287C0.924883 6.33065 0.650024 6.6748 0.650024 7.07183V7.92817C0.650024 8.32521 0.924883 8.66935 1.31209 8.75714L2.36228 8.99521C2.47246 9.37417 2.62335 9.7357 2.80979 10.0747L2.2354 10.9857C2.02367 11.3215 2.07267 11.7592 2.35341 12.04L2.95951 12.6461C3.24025 12.9268 3.67795 12.9758 4.01382 12.7641L4.92506 12.1897C5.26384 12.376 5.62516 12.5268 6.0039 12.6369L6.24198 13.6877C6.32977 14.0749 6.67391 14.3498 7.07095 14.3498H7.92729C8.32433 14.3498 8.66847 14.0749 8.75626 13.6877L8.99429 12.6371C9.37342 12.5269 9.73512 12.3759 10.0743 12.1894L10.9853 12.7639C11.3212 12.9756 11.7589 12.9266 12.0396 12.6459L12.6457 12.0398C12.9265 11.759 12.9755 11.3213 12.7637 10.9854L12.1893 10.0745C12.3758 9.73536 12.5268 9.37378 12.637 8.99487L13.6879 8.75714C14.0751 8.66935 14.35 8.32521 14.35 7.92817V7.07183C14.35 6.6748 14.0751 6.33065 13.6879 6.24287L12.6366 6.00433C12.5264 5.62576 12.3755 5.26433 12.1892 4.92548L12.7635 4.01474C12.9753 3.67887 12.9263 3.24117 12.6455 2.96043L12.0394 2.35433C11.7587 2.07359 11.321 2.0246 10.9851 2.23632L10.0745 2.81064C9.73556 2.62419 9.37392 2.47328 8.99496 2.36307L8.75626 1.31231C8.66847 0.925096 8.32433 0.650238 7.92729 0.650238H7.07095ZM4.92053 3.81251C5.44724 3.44339 6.05665 3.18424 6.71543 3.06839L7.07095 1.50024H7.92729L8.28281 3.06839C8.94159 3.18424 9.551 3.44339 10.0777 3.81251L11.4809 2.98193L12.0194 3.52041L11.1889 4.92381C11.558 5.45052 11.8171 6.05992 11.933 6.71869L13.5011 7.07419V7.93014L11.933 8.28566C11.8171 8.94443 11.558 9.55383 11.1889 10.0805L12.0194 11.4839L11.4809 12.0224L10.0777 11.1919C9.551 11.561 8.94159 11.8201 8.28281 11.936L7.92729 13.5041H7.07095L6.71543 11.936C6.05665 11.8201 5.44724 11.561 4.92053 11.1919L3.51713 12.0224L2.97865 11.4839L3.80922 10.0805C3.4401 9.55383 3.18095 8.94443 3.0651 8.28566L1.49694 7.93014V7.07419L3.0651 6.71869C3.18095 6.05992 3.4401 5.45052 3.80922 4.92381L2.97865 3.52041L3.51713 2.98193L4.92053 3.81251ZM7.49912 10.5C9.15578 10.5 10.4991 9.15664 10.4991 7.49998C10.4991 5.84332 9.15578 4.49998 7.49912 4.49998C5.84246 4.49998 4.49912 5.84332 4.49912 7.49998C4.49912 9.15664 5.84246 10.5 7.49912 10.5ZM7.49912 9.5C8.60369 9.5 9.49912 8.60456 9.49912 7.49998C9.49912 6.39541 8.60369 5.49998 7.49912 5.49998C6.39455 5.49998 5.49912 6.39541 5.49912 7.49998C5.49912 8.60456 6.39455 9.5 7.49912 9.5Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
        <span>Advanced</span>
        <span css={css`margin-left: auto;`}>
          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </span>
      </button>

      {isExpanded && (
        <div css={css`
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--grey-2);
        `}>
          <ApiKeyManager userId={userId} />
        </div>
      )}
    </div>
  )
}
