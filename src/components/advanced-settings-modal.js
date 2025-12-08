/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Cross2Icon, PlusIcon, TrashIcon, CopyIcon, CheckIcon, EyeOpenIcon, EyeClosedIcon } from '@radix-ui/react-icons'

import { IconButton } from './button'
import ModalOverlay from './modal-overlay'
import Spinner from './spinner'

const SectionHeader = ({ children }) => (
  <h3
    css={css`
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--grey-3);
      margin: 0 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--grey-2);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `}
  >
    {children}
  </h3>
)

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

  // Fetch existing API keys
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

      // Store the newly created key to show to user
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
      <div css={css`display: flex; justify-content: center; padding: 2rem;`}>
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <SectionHeader>API Keys</SectionHeader>

      <p css={css`
        font-size: 0.85rem;
        color: var(--grey-3);
        margin-bottom: 1.5rem;
        line-height: 1.5;
      `}>
        API keys allow you to access your Bublr data programmatically. You can list posts,
        read post content, view your profile, and publish new content via the API.
      </p>

      {/* Newly created key display */}
      {newlyCreatedKey && (
        <div css={css`
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1.5rem;
        `}>
          <p css={css`
            margin: 0 0 0.75rem 0;
            font-size: 0.85rem;
            font-weight: 500;
            color: #166534;
          `}>
            API key created successfully!
          </p>
          <p css={css`
            margin: 0 0 0.75rem 0;
            font-size: 0.8rem;
            color: #166534;
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
              background: white;
              padding: 0.5rem 0.75rem;
              border-radius: 0.25rem;
              font-size: 0.75rem;
              word-break: break-all;
              border: 1px solid #86efac;
            `}>
              {showKey ? newlyCreatedKey : '••••••••••••••••••••••••••••••••'}
            </code>

            <button
              onClick={() => setShowKey(!showKey)}
              css={css`
                background: white;
                border: 1px solid #86efac;
                border-radius: 0.25rem;
                padding: 0.5rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                color: #166534;
                &:hover { background: #dcfce7; }
              `}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
            </button>

            <button
              onClick={handleCopyKey}
              css={css`
                background: white;
                border: 1px solid #86efac;
                border-radius: 0.25rem;
                padding: 0.5rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                color: #166534;
                &:hover { background: #dcfce7; }
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
              font-size: 0.8rem;
              color: #166534;
              background: none;
              border: none;
              cursor: pointer;
              text-decoration: underline;
              &:hover { opacity: 0.8; }
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
      <div css={css`
        background: var(--grey-1);
        border: 1px solid var(--grey-2);
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 1.5rem;
      `}>
        <StyledLabel htmlFor="api-key-name">Create New API Key</StyledLabel>
        <div css={css`display: flex; gap: 0.5rem;`}>
          <input
            id="api-key-name"
            type="text"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., My Blog Integration)"
            maxLength={50}
            disabled={creating || keys.length >= 5}
            css={css`
              flex: 1;
              padding: 0.5rem 0.75rem;
              font-size: 0.85rem;
              border: 1px solid var(--grey-2);
              border-radius: 0.5rem;
              background: var(--grey-1);
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
              padding: 0.5rem 1rem;
              border-radius: 0.5rem;
              font-size: 0.85rem;
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
            {creating ? (
              <>Creating...</>
            ) : (
              <>
                <PlusIcon width={14} height={14} />
                Create
              </>
            )}
          </button>
        </div>
        {keys.length >= 5 && (
          <p css={css`
            font-size: 0.75rem;
            color: var(--grey-3);
            margin-top: 0.5rem;
          `}>
            Maximum of 5 API keys allowed. Revoke an existing key to create a new one.
          </p>
        )}
      </div>

      {/* Existing keys list */}
      <div>
        <h4 css={css`
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--grey-4);
          margin: 0 0 0.75rem 0;
        `}>
          Your API Keys ({keys.length}/5)
        </h4>

        {keys.length === 0 ? (
          <p css={css`
            font-size: 0.85rem;
            color: var(--grey-3);
            text-align: center;
            padding: 2rem;
            background: var(--grey-1);
            border: 1px dashed var(--grey-2);
            border-radius: 0.5rem;
          `}>
            No API keys yet. Create one to get started.
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
                  padding: 0.75rem 1rem;
                  background: var(--grey-1);
                  border: 1px solid var(--grey-2);
                  border-radius: 0.5rem;
                `}
              >
                <div>
                  <p css={css`
                    margin: 0;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--grey-4);
                  `}>
                    {key.name}
                  </p>
                  <p css={css`
                    margin: 0.25rem 0 0 0;
                    font-size: 0.75rem;
                    color: var(--grey-3);
                    font-family: monospace;
                  `}>
                    {key.keyPrefix}
                  </p>
                  <p css={css`
                    margin: 0.25rem 0 0 0;
                    font-size: 0.7rem;
                    color: var(--grey-3);
                  `}>
                    Created: {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && ` • Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>

                <button
                  onClick={() => handleRevokeKey(key.id)}
                  disabled={revoking === key.id}
                  css={css`
                    background: none;
                    color: #dc2626;
                    border: 1px solid #dc2626;
                    padding: 0.4rem 0.75rem;
                    border-radius: 0.375rem;
                    font-size: 0.75rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    opacity: ${revoking === key.id ? 0.5 : 1};

                    &:hover:not(:disabled) {
                      background: #fef2f2;
                    }

                    &:disabled {
                      cursor: not-allowed;
                    }
                  `}
                >
                  <TrashIcon width={12} height={12} />
                  {revoking === key.id ? 'Revoking...' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Documentation */}
      <SectionHeader>API Documentation</SectionHeader>

      <div css={css`
        background: var(--grey-1);
        border: 1px solid var(--grey-2);
        border-radius: 0.5rem;
        padding: 1rem;
        font-size: 0.8rem;
        color: var(--grey-4);
      `}>
        <p css={css`margin: 0 0 1rem 0;`}>
          <strong>Base URL:</strong>{' '}
          <code css={css`
            background: var(--grey-2);
            padding: 0.1rem 0.3rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
          `}>
            https://bublr.life/api/v1
          </code>
        </p>

        <p css={css`margin: 0 0 0.5rem 0;`}>
          <strong>Authentication:</strong> Include your API key in the Authorization header:
        </p>
        <code css={css`
          display: block;
          background: var(--grey-2);
          padding: 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          margin-bottom: 1rem;
          word-break: break-all;
        `}>
          Authorization: Bearer bublr_sk_your_api_key
        </code>

        <p css={css`margin: 0 0 0.5rem 0; font-weight: 500;`}>Available Endpoints:</p>
        <ul css={css`
          margin: 0;
          padding-left: 1.25rem;
          line-height: 1.8;
        `}>
          <li><code>GET /profile</code> - Get your profile info</li>
          <li><code>GET /posts</code> - List your posts</li>
          <li><code>GET /posts/:slug</code> - Get a single post</li>
          <li><code>POST /posts</code> - Create a new post</li>
          <li><code>PUT /posts/:slug</code> - Update a post</li>
          <li><code>DELETE /posts/:slug</code> - Delete a post</li>
        </ul>
      </div>
    </div>
  )
}

export default function AdvancedSettingsModal({ Trigger, uid }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Trigger />
      </Dialog.Trigger>

      <ModalOverlay />

      <Dialog.Content
        css={css`
          background: var(--grey-1);
          border-radius: 0.5rem;
          padding: 0;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 500px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
        `}
      >
        {/* Fixed Header */}
        <div css={css`
          padding: 1.5rem 1.5rem 1rem 1.5rem;
          flex-shrink: 0;
        `}>
          <Dialog.Title css={css`margin: 0;`}>Advanced Settings</Dialog.Title>
          <Dialog.Description
            css={css`
              margin: 0.5rem 0 0 0;
              color: var(--grey-3);
              font-size: 0.9rem;
            `}
          >
            Manage API keys and developer options
          </Dialog.Description>
        </div>

        {/* Scrollable Content */}
        <div
          css={css`
            flex: 1;
            overflow-y: auto;
            padding: 0 1.5rem 1.5rem 1.5rem;

            /* Hide scrollbar for Chrome, Safari and Opera */
            &::-webkit-scrollbar {
              display: none;
            }

            /* Hide scrollbar for IE, Edge and Firefox */
            -ms-overflow-style: none;
            scrollbar-width: none;
          `}
        >
          <ApiKeyManager userId={uid} />
        </div>

        <Dialog.Close asChild>
          <IconButton
            css={css`
              position: absolute;
              top: 1rem;
              right: 1rem;
            `}
          >
            <Cross2Icon />
          </IconButton>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  )
}
