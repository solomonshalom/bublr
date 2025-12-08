/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Cross2Icon, PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, DragHandleDots2Icon, ExternalLinkIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons'
import { useDocumentData } from 'react-firebase-hooks/firestore'

import { firestore, auth } from '../lib/firebase'
import { userWithNameExists } from '../lib/db'
import { uploadToImgBB } from '../lib/utils'

import Spinner from './spinner'
import Input, { Textarea } from './input'
import ModalOverlay from './modal-overlay'
import Button, { IconButton } from './button'
import ApiKeySection from './api-key-section'

// Status badge component for domain status
const StatusBadge = ({ status }) => {
  const colors = {
    verified: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    pending: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
    error: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  }
  const c = colors[status] || colors.pending

  return (
    <span
      css={css`
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.7rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border-radius: 9999px;
        background: ${c.bg};
        color: ${c.text};
        border: 1px solid ${c.border};
      `}
    >
      {status === 'verified' && <CheckCircledIcon width={12} height={12} />}
      {status === 'pending' && <span css={css`width: 8px; height: 8px; border-radius: 50%; background: ${c.text};`} />}
      {status === 'error' && <CrossCircledIcon width={12} height={12} />}
      {status}
    </span>
  )
}

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

const SectionHeader = ({ children }) => (
  <h3
    css={css`
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--grey-3);
      margin: 2rem 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--grey-2);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `}
  >
    {children}
  </h3>
)

const SmallInput = props => (
  <Input
    {...props}
    css={css`
      width: 100%;
      padding: 0.5em 0.75em;
      font-size: 0.85rem;
    `}
  />
)

// Camera icon for overlay
const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

// Profile Picture Upload Component
const ProfilePictureUpload = ({ currentPhoto, onPhotoChange }) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const apiKey = process.env.NEXT_PUBLIC_IMGBB_API
      if (!apiKey) {
        setError('Image upload not configured')
        return
      }

      const imageUrl = await uploadToImgBB(file, apiKey)

      if (imageUrl) {
        onPhotoChange(imageUrl)
      } else {
        setError('Failed to upload image')
      }
    } catch (err) {
      console.error('Profile picture upload error:', err)
      setError('Failed to upload image')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div css={css`margin-bottom: 1.5rem;`}>
      <StyledLabel>Profile Picture</StyledLabel>
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 1rem;
        `}
      >
        {/* Avatar Preview with Overlay */}
        <div
          css={css`
            position: relative;
            width: 72px;
            height: 72px;
            border-radius: 50%;
            overflow: hidden;
            cursor: pointer;
            flex-shrink: 0;

            &:hover .overlay {
              opacity: 1;
            }
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <img
            src={currentPhoto || 'https://api.dicebear.com/7.x/shapes/svg?seed=default'}
            alt="Profile"
            css={css`
              width: 100%;
              height: 100%;
              object-fit: cover;
              background: var(--grey-2);
            `}
          />
          <div
            className="overlay"
            css={css`
              position: absolute;
              inset: 0;
              background: rgba(0, 0, 0, 0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              opacity: 0;
              transition: opacity 0.2s ease;
              color: white;
            `}
          >
            {uploading ? (
              <span
                css={css`
                  width: 20px;
                  height: 20px;
                  border: 2px solid white;
                  border-bottom-color: transparent;
                  border-radius: 50%;
                  animation: spin 0.8s linear infinite;
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}
              />
            ) : (
              <CameraIcon />
            )}
          </div>
        </div>

        {/* Upload button and info */}
        <div css={css`flex: 1;`}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            css={css`
              background: none;
              color: var(--grey-4);
              border: 1px solid var(--grey-2);
              padding: 0.5rem 0.75rem;
              border-radius: 0.5rem;
              font-size: 0.8rem;
              cursor: pointer;
              transition: all 0.2s ease;
              display: flex;
              align-items: center;
              gap: 0.4rem;

              &:hover:not(:disabled) {
                border-color: var(--grey-3);
                color: var(--grey-5);
              }

              &:disabled {
                opacity: 0.6;
                cursor: not-allowed;
              }
            `}
          >
            {uploading ? (
              <>
                <span
                  css={css`
                    width: 12px;
                    height: 12px;
                    border: 1.5px solid currentColor;
                    border-bottom-color: transparent;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                  `}
                />
                Uploading...
              </>
            ) : (
              'Change Photo'
            )}
          </button>
          <p
            css={css`
              font-size: 0.7rem;
              color: var(--grey-3);
              margin: 0.5rem 0 0 0;
            `}
          >
            JPG, PNG or GIF. Max 5MB.
          </p>
          {error && (
            <p
              css={css`
                font-size: 0.75rem;
                color: #dc2626;
                margin: 0.5rem 0 0 0;
              `}
            >
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        css={css`display: none;`}
      />
    </div>
  )
}

const TagInput = ({ tags, onChange, placeholder }) => {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const value = inputValue.trim()
      if (value && !tags.includes(value)) {
        onChange([...tags, value])
        setInputValue('')
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  const removeTag = index => {
    onChange(tags.filter((_, i) => i !== index))
  }

  return (
    <div
      css={css`
        border: 1px solid var(--grey-2);
        border-radius: 0.5rem;
        padding: 0.5rem;
        min-height: 2.5rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      `}
    >
      {tags.map((tag, index) => (
        <span
          key={index}
          css={css`
            display: inline-flex;
            align-items: center;
            background: var(--grey-2);
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.8rem;
            gap: 0.25rem;
          `}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            css={css`
              background: none;
              border: none;
              cursor: pointer;
              padding: 0;
              display: flex;
              align-items: center;
              color: var(--grey-3);
              &:hover {
                color: var(--grey-4);
              }
            `}
          >
            <Cross2Icon width={12} height={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        css={css`
          border: none;
          outline: none;
          background: none;
          flex: 1;
          min-width: 100px;
          font-size: 0.85rem;
          color: var(--grey-4);
          &::placeholder {
            color: var(--grey-3);
          }
        `}
      />
    </div>
  )
}

// Default email template for reference
const DEFAULT_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New post from {{authorName}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #2e2e2e; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Color bar -->
          <tr>
            <td style="height: 4px; background-color: {{postColor}};"></td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <!-- Author info -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="width: 40px; vertical-align: middle;">
                    <img src="{{authorPhoto}}" alt="{{authorName}}" width="40" height="40" style="border-radius: 50%; display: block;">
                  </td>
                  <td style="padding-left: 12px; vertical-align: middle;">
                    <span style="font-weight: 500; color: #2e2e2e;">{{authorName}}</span>
                    <span style="color: #6f6f6f;"> published a new post</span>
                  </td>
                </tr>
              </table>

              <!-- Post title -->
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 500; color: #2e2e2e; line-height: 1.3;">
                <a href="{{postUrl}}" style="color: inherit; text-decoration: none;">{{title}}</a>
              </h1>

              <!-- Excerpt/Preview -->
              <p style="margin: 0 0 20px 0; color: #6f6f6f; font-size: 14px; line-height: 1.6;">
                {{excerpt}}
              </p>

              <!-- Content preview -->
              <p style="margin: 0 0 24px 0; color: #6f6f6f; font-size: 14px; line-height: 1.7;">
                {{content}}
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="background-color: #2e2e2e; border-radius: 6px;">
                    <a href="{{postUrl}}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 500; font-size: 14px;">
                      Read Full Post
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e5e5e5; padding-top: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #9a9a9a;">
                      You're receiving this because you subscribed to {{authorName}}'s newsletter on Bublr.
                    </p>
                    <p style="margin: 0; font-size: 12px;">
                      <a href="{{unsubscribeUrl}}" style="color: #6f6f6f; text-decoration: underline;">Unsubscribe</a>
                      <span style="color: #c7c7c7; margin: 0 8px;">|</span>
                      <a href="https://bublr.life" style="color: #6f6f6f; text-decoration: underline;">Visit Bublr</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

// Newsletter Template Section Component (for paid users)
function NewsletterTemplateSection({ userId, hasAccess, currentTemplate, onError, onSuccess }) {
  const [template, setTemplate] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Initialize template from current value or default
  useEffect(() => {
    if (currentTemplate?.html) {
      setTemplate(currentTemplate.html)
    }
  }, [currentTemplate])

  const handleSaveTemplate = async () => {
    setSaving(true)
    onError(null)
    onSuccess(null)

    try {
      const res = await fetch('/api/newsletter/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, htmlTemplate: template }),
      })
      const data = await res.json()

      if (res.ok) {
        onSuccess(data.message || 'Newsletter template saved successfully!')
      } else {
        onError(data.error || 'Failed to save template')
      }
    } catch (err) {
      onError('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleResetTemplate = async () => {
    if (!confirm('Reset to the default newsletter template? Your custom template will be deleted.')) return

    setSaving(true)
    onError(null)
    onSuccess(null)

    try {
      const res = await fetch('/api/newsletter/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, htmlTemplate: null }),
      })
      const data = await res.json()

      if (res.ok) {
        setTemplate('')
        onSuccess('Newsletter template reset to default')
      } else {
        onError(data.error || 'Failed to reset template')
      }
    } catch (err) {
      onError('Failed to reset template')
    } finally {
      setSaving(false)
    }
  }

  const handleLoadDefault = () => {
    setTemplate(DEFAULT_EMAIL_TEMPLATE)
  }

  if (!hasAccess) return null

  return (
    <div css={css`margin-bottom: 1.5rem; margin-top: 1.5rem;`}>
      <div css={css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      `}>
        <StyledLabel css={css`margin-bottom: 0;`}>Newsletter Email Template</StyledLabel>
        <button
          onClick={() => setExpanded(!expanded)}
          css={css`
            background: none;
            border: none;
            cursor: pointer;
            font-size: 0.75rem;
            color: var(--grey-3);
            display: flex;
            align-items: center;
            gap: 0.25rem;

            &:hover {
              color: var(--grey-4);
            }
          `}
        >
          {expanded ? (
            <>
              <ChevronUpIcon width={14} height={14} />
              Collapse
            </>
          ) : (
            <>
              <ChevronDownIcon width={14} height={14} />
              {currentTemplate?.html ? 'Edit template' : 'Customize'}
            </>
          )}
        </button>
      </div>

      {!expanded && currentTemplate?.html && (
        <p css={css`font-size: 0.75rem; color: var(--grey-3); margin: 0;`}>
          Using custom template (last updated: {new Date(currentTemplate.updatedAt).toLocaleDateString()})
        </p>
      )}

      {!expanded && !currentTemplate?.html && (
        <p css={css`font-size: 0.75rem; color: var(--grey-3); margin: 0;`}>
          Using default Bublr template. Click to customize the HTML email sent to your subscribers.
        </p>
      )}

      {expanded && (
        <>
          {/* Available Tags Reference */}
          <div css={css`margin-bottom: 1rem;`}>
            <p css={css`
              font-size: 0.8rem;
              color: var(--grey-3);
              margin: 0 0 0.5rem 0;
            `}>
              Available placeholder tags:
            </p>
            <div css={css`
              display: flex;
              flex-wrap: wrap;
              gap: 0.5rem;
            `}>
              {[
                { tag: '{{title}}', desc: 'Post title' },
                { tag: '{{excerpt}}', desc: 'Post excerpt' },
                { tag: '{{content}}', desc: 'Content preview' },
                { tag: '{{authorName}}', desc: 'Your name' },
                { tag: '{{authorPhoto}}', desc: 'Your photo URL' },
                { tag: '{{postUrl}}', desc: 'Link to post' },
                { tag: '{{postColor}}', desc: 'Post color' },
                { tag: '{{unsubscribeUrl}}', desc: 'Unsubscribe link (required)' },
              ].map(({ tag, desc }) => (
                <span
                  key={tag}
                  title={desc}
                  css={css`
                    background: var(--grey-2);
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    font-size: 0.75rem;
                    font-family: inherit;
                    color: var(--grey-4);
                    cursor: help;
                  `}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Warning about unsubscribe link */}
          <p css={css`
            font-size: 0.75rem;
            color: var(--grey-3);
            margin: 0 0 1rem 0;
          `}>
            Your template must include <code css={css`background: var(--grey-2); padding: 0.15rem 0.35rem; border-radius: 0.25rem;`}>{'{{unsubscribeUrl}}'}</code> for email compliance.
          </p>

          {/* Template Editor */}
          <div css={css`margin-bottom: 1rem;`}>
            <Textarea
              value={template}
              onChange={e => setTemplate(e.target.value)}
              placeholder="Paste your custom HTML email template here..."
              css={css`
                width: 100%;
                min-height: 12em;
                font-size: 0.85rem;
              `}
            />
          </div>

          {/* Action Buttons */}
          <div css={css`
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
          `}>
            <button
              onClick={handleSaveTemplate}
              disabled={saving || !template.trim()}
              css={css`
                background: var(--grey-5);
                color: var(--grey-1);
                border: none;
                padding: 0.5rem 0.75rem;
                border-radius: 0.5rem;
                font-size: 0.8rem;
                cursor: pointer;
                opacity: ${saving || !template.trim() ? 0.5 : 1};

                &:hover:not(:disabled) {
                  opacity: 0.8;
                }
              `}
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>

            <button
              onClick={handleLoadDefault}
              disabled={saving}
              css={css`
                background: none;
                color: var(--grey-4);
                border: 1px solid var(--grey-2);
                padding: 0.5rem 0.75rem;
                border-radius: 0.5rem;
                font-size: 0.8rem;
                cursor: pointer;

                &:hover:not(:disabled) {
                  border-color: var(--grey-3);
                }
              `}
            >
              Load Default
            </button>

            {currentTemplate?.html && (
              <button
                onClick={handleResetTemplate}
                disabled={saving}
                css={css`
                  background: none;
                  color: var(--grey-3);
                  border: 1px solid var(--grey-2);
                  padding: 0.5rem 0.75rem;
                  border-radius: 0.5rem;
                  font-size: 0.8rem;
                  cursor: pointer;

                  &:hover {
                    color: #dc2626;
                    border-color: #dc2626;
                  }
                `}
              >
                Reset
              </button>
            )}
          </div>

          <p css={css`
            font-size: 0.75rem;
            color: var(--grey-3);
            margin: 0.75rem 0 0 0;
          `}>
            Click &quot;Load Default&quot; to start with our template and customize from there.
          </p>
        </>
      )}
    </div>
  )
}

// Custom Domain Section Component
function CustomDomainSection({ userId, userName }) {
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [domain, setDomain] = useState('')
  const [footerText, setFooterText] = useState('')
  const [domainError, setDomainError] = useState(null)
  const [domainSuccess, setDomainSuccess] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [emailFromAuth, setEmailFromAuth] = useState(false)

  // Get email from Firebase Auth directly
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Try to get email from user object or providerData
        const email = user.email ||
          (user.providerData && user.providerData[0]?.email) ||
          null
        if (email) {
          setUserEmail(email)
          setEmailFromAuth(true)
        }
      }
    })
    return () => unsubscribe()
  }, [])

  // Fetch subscription status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/subscription/status?userId=${userId}`)
        const data = await res.json()
        setSubscriptionStatus(data)
        if (data.customDomain?.domain) {
          setDomain(data.customDomain.domain)
        }
        if (data.customBranding?.footerText !== undefined) {
          setFooterText(data.customBranding.footerText)
        }
      } catch (err) {
        console.error('Error fetching subscription status:', err)
      } finally {
        setLoading(false)
      }
    }
    if (userId) {
      fetchStatus()
    }
  }, [userId])

  const handleSubscribe = async () => {
    // Validate required fields before making API call
    if (!userId) {
      setDomainError('User ID not available. Please try refreshing the page.')
      return
    }
    if (!userEmail || !userEmail.includes('@')) {
      setDomainError('Please enter a valid email address.')
      return
    }

    setActionLoading(true)
    setDomainError(null)
    try {
      const res = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userEmail, userName }),
      })
      const data = await res.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        setDomainError(data.error || 'Failed to create checkout session')
      }
    } catch (err) {
      setDomainError('Failed to create checkout session')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSetDomain = async () => {
    setDomainError(null)
    setDomainSuccess(null)
    setActionLoading(true)

    try {
      const res = await fetch('/api/domain/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, domain: domain.toLowerCase().trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        setDomainSuccess(data.message)
        // Refresh status
        const statusRes = await fetch(`/api/subscription/status?userId=${userId}`)
        const statusData = await statusRes.json()
        setSubscriptionStatus(statusData)
      } else {
        setDomainError(data.error || 'Failed to set domain')
      }
    } catch (err) {
      setDomainError('Failed to set domain')
    } finally {
      setActionLoading(false)
    }
  }

  const handleVerifyDomain = async () => {
    setVerifying(true)
    setDomainError(null)
    setDomainSuccess(null)

    try {
      const res = await fetch('/api/domain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()

      if (data.verified) {
        setDomainSuccess('Domain verified successfully!')
        // Refresh status
        const statusRes = await fetch(`/api/subscription/status?userId=${userId}`)
        const statusData = await statusRes.json()
        setSubscriptionStatus(statusData)
      } else {
        // Use the detailed message from the API
        setDomainError(data.message || 'Domain not yet verified. Please check your DNS settings.')
        // Refresh status to get updated verification requirements
        const statusRes = await fetch(`/api/subscription/status?userId=${userId}`)
        const statusData = await statusRes.json()
        setSubscriptionStatus(statusData)
      }
    } catch (err) {
      setDomainError('Failed to verify domain')
    } finally {
      setVerifying(false)
    }
  }

  const handleRemoveDomain = async () => {
    if (!confirm('Are you sure you want to remove your custom domain?')) return

    setActionLoading(true)
    setDomainError(null)

    try {
      const res = await fetch('/api/domain/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()

      if (res.ok) {
        setDomain('')
        setDomainSuccess('Domain removed successfully')
        // Refresh status
        const statusRes = await fetch(`/api/subscription/status?userId=${userId}`)
        const statusData = await statusRes.json()
        setSubscriptionStatus(statusData)
      } else {
        setDomainError(data.error || 'Failed to remove domain')
      }
    } catch (err) {
      setDomainError('Failed to remove domain')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateBranding = async () => {
    setDomainError(null)
    setDomainSuccess(null)
    setActionLoading(true)

    try {
      const res = await fetch('/api/domain/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, footerText }),
      })
      const data = await res.json()

      if (res.ok) {
        setDomainSuccess('Branding updated successfully!')
      } else {
        setDomainError(data.error || 'Failed to update branding')
      }
    } catch (err) {
      setDomainError('Failed to update branding')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <SectionHeader>Custom Domain</SectionHeader>
        <div css={css`display: flex; justify-content: center; padding: 2rem;`}>
          <Spinner />
        </div>
      </>
    )
  }

  const hasAccess = subscriptionStatus?.hasCustomDomainAccess
  const currentDomain = subscriptionStatus?.customDomain
  const verification = currentDomain?.verification || []

  return (
    <>
      <SectionHeader>Custom Domain</SectionHeader>

      {/* Subscription promo / status */}
      {!hasAccess ? (
        <div
          css={css`
            position: relative;
            background: #DD814C;
            background: linear-gradient(315deg, #DD814C, #BC3C00);
            border-radius: 0.75rem;
            padding: 1.25rem;
            color: white;
            margin-bottom: 1rem;
            overflow: hidden;

            &::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background-image: url('https://lovable.dev/_next/static/media/grain.1ccdda41.png');
              background-size: 100px 100px;
              background-repeat: repeat;
              background-position: left top;
              mix-blend-mode: overlay;
              opacity: 0.5;
              pointer-events: none;
            }
          `}
        >
          <div css={css`position: relative; z-index: 1;`}>
            <h4 css={css`margin: 0 0 0.5rem 0; font-size: 1rem; font-weight: 600;`}>
              Upgrade to Custom Domain
            </h4>
            <p css={css`font-size: 0.85rem; margin: 0 0 1rem 0; opacity: 0.9;`}>
              Use your own domain (e.g., blog.yoursite.com) and customize the &quot;Made with Bublr&quot; footer text.
            </p>

            {/* Email input if not available from auth */}
            {!emailFromAuth && (
              <div css={css`margin-bottom: 1rem;`}>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter your email for billing"
                  css={css`
                    width: 100%;
                    padding: 0.6rem 0.75rem;
                    border: none;
                    border-radius: 0.5rem;
                    font-size: 0.85rem;
                    background: rgba(255,255,255,0.9);
                    color: #333;

                    &::placeholder {
                      color: #999;
                    }

                    &:focus {
                      outline: none;
                      background: white;
                    }
                  `}
                />
              </div>
            )}

            <div css={css`display: flex; align-items: center; justify-content: space-between;`}>
              <span css={css`font-size: 1.25rem; font-weight: 700;`}>$2/month</span>
              <button
                onClick={handleSubscribe}
                disabled={actionLoading || (!emailFromAuth && !userEmail.includes('@'))}
                css={css`
                  background: white;
                  color: #BC3C00;
                  border: none;
                  padding: 0.6rem 1.25rem;
                  border-radius: 0.5rem;
                  font-weight: 600;
                  font-size: 0.85rem;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  opacity: ${actionLoading || (!emailFromAuth && !userEmail.includes('@')) ? 0.7 : 1};

                  &:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                  }
                `}
              >
                {actionLoading ? 'Loading...' : 'Subscribe'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Domain input section */}
          <div css={css`margin-bottom: 1.25rem;`}>
            <StyledLabel htmlFor="custom-domain">Your Domain</StyledLabel>
            <div css={css`display: flex; gap: 0.5rem; align-items: flex-start;`}>
              <div css={css`flex: 1;`}>
                <SmallInput
                  id="custom-domain"
                  type="text"
                  value={domain}
                  onChange={e => {
                    setDomain(e.target.value)
                    setDomainError(null)
                    setDomainSuccess(null)
                  }}
                  placeholder="blog.yoursite.com"
                  disabled={currentDomain?.status === 'verified'}
                />
              </div>
              {currentDomain?.domain ? (
                <div css={css`display: flex; gap: 0.25rem;`}>
                  {currentDomain.status !== 'verified' && (
                    <button
                      onClick={handleVerifyDomain}
                      disabled={verifying}
                      css={css`
                        background: var(--grey-5);
                        color: var(--grey-1);
                        border: none;
                        padding: 0.5rem 0.75rem;
                        border-radius: 0.5rem;
                        font-size: 0.8rem;
                        cursor: pointer;
                        white-space: nowrap;
                        opacity: ${verifying ? 0.7 : 1};

                        &:hover:not(:disabled) {
                          opacity: 0.8;
                        }
                      `}
                    >
                      {verifying ? 'Verifying...' : 'Verify'}
                    </button>
                  )}
                  <button
                    onClick={handleRemoveDomain}
                    disabled={actionLoading}
                    css={css`
                      background: none;
                      color: #dc2626;
                      border: 1px solid #dc2626;
                      padding: 0.5rem 0.75rem;
                      border-radius: 0.5rem;
                      font-size: 0.8rem;
                      cursor: pointer;
                      white-space: nowrap;

                      &:hover {
                        background: #fef2f2;
                      }
                    `}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSetDomain}
                  disabled={actionLoading || !domain.trim()}
                  css={css`
                    background: var(--grey-5);
                    color: var(--grey-1);
                    border: none;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                    font-size: 0.8rem;
                    cursor: pointer;
                    white-space: nowrap;
                    opacity: ${actionLoading || !domain.trim() ? 0.5 : 1};

                    &:hover:not(:disabled) {
                      opacity: 0.8;
                    }
                  `}
                >
                  {actionLoading ? 'Adding...' : 'Add Domain'}
                </button>
              )}
            </div>

            {/* Domain status badge */}
            {currentDomain && (
              <div css={css`margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;`}>
                <StatusBadge status={currentDomain.status} />
                {currentDomain.status === 'verified' && (
                  <a
                    href={`https://${currentDomain.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    css={css`
                      font-size: 0.75rem;
                      color: var(--grey-3);
                      display: inline-flex;
                      align-items: center;
                      gap: 0.25rem;
                      &:hover { color: var(--grey-4); }
                    `}
                  >
                    Visit site <ExternalLinkIcon width={12} height={12} />
                  </a>
                )}
              </div>
            )}

            {/* DNS verification instructions (from Vercel API) */}
            {currentDomain?.status === 'pending' && verification.length > 0 && (
              <div
                css={css`
                  margin-top: 1rem;
                  background: var(--grey-1);
                  border: 1px solid var(--grey-2);
                  border-radius: 0.5rem;
                  padding: 1rem;
                  font-size: 0.8rem;
                `}
              >
                <p css={css`margin: 0 0 1rem 0; font-weight: 500; color: var(--grey-4);`}>
                  Configure your DNS settings
                </p>
                {verification.map((v, i) => (
                  <div key={i} css={css`
                    background: var(--grey-2);
                    border-radius: 0.375rem;
                    padding: 0.75rem;
                    margin-bottom: 0.75rem;
                    font-family: monospace;
                  `}>
                    <div css={css`display: grid; grid-template-columns: 80px 1fr; gap: 0.5rem; color: var(--grey-4);`}>
                      <span css={css`color: var(--grey-3);`}>Type:</span>
                      <span>{v.type}</span>
                      <span css={css`color: var(--grey-3);`}>Name:</span>
                      <span>{v.domain}</span>
                      <span css={css`color: var(--grey-3);`}>Value:</span>
                      <span css={css`word-break: break-all;`}>{v.value}</span>
                    </div>
                  </div>
                ))}
                <p css={css`margin: 0; font-size: 0.75rem; color: var(--grey-3);`}>
                  DNS changes typically take 5-30 minutes but can take up to 48 hours. Click &quot;Verify&quot; after updating your DNS.
                </p>
              </div>
            )}

            {/* DNS instructions for pending domains */}
            {currentDomain?.status === 'pending' && verification.length === 0 && (
              <div
                css={css`
                  margin-top: 1rem;
                  background: var(--grey-1);
                  border: 1px solid var(--grey-2);
                  border-radius: 0.5rem;
                  padding: 1rem;
                  font-size: 0.8rem;
                `}
              >
                <p css={css`margin: 0 0 1rem 0; font-weight: 500; color: var(--grey-4);`}>
                  Configure your DNS settings
                </p>

                {/* Check if it's a subdomain or apex domain */}
                {currentDomain.domain.split('.').length > 2 ? (
                  /* Subdomain instructions */
                  <div css={css`margin-bottom: 1rem;`}>
                    <p css={css`margin: 0 0 0.5rem 0; color: var(--grey-3); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;`}>
                      For subdomains (e.g., blog.yoursite.com)
                    </p>
                    <div css={css`
                      background: var(--grey-2);
                      border-radius: 0.375rem;
                      padding: 0.75rem;
                      font-family: monospace;
                    `}>
                      <div css={css`display: grid; grid-template-columns: 80px 1fr; gap: 0.5rem; color: var(--grey-4);`}>
                        <span css={css`color: var(--grey-3);`}>Type:</span>
                        <span>CNAME</span>
                        <span css={css`color: var(--grey-3);`}>Name:</span>
                        <span>{currentDomain.domain.split('.')[0]}</span>
                        <span css={css`color: var(--grey-3);`}>Value:</span>
                        <span css={css`word-break: break-all;`}>cname.vercel-dns.com</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Apex domain instructions */
                  <div css={css`margin-bottom: 1rem;`}>
                    <p css={css`margin: 0 0 0.5rem 0; color: var(--grey-3); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;`}>
                      For apex domains (e.g., yoursite.com)
                    </p>
                    <div css={css`
                      background: var(--grey-2);
                      border-radius: 0.375rem;
                      padding: 0.75rem;
                      font-family: monospace;
                    `}>
                      <div css={css`display: grid; grid-template-columns: 80px 1fr; gap: 0.5rem; color: var(--grey-4);`}>
                        <span css={css`color: var(--grey-3);`}>Type:</span>
                        <span>A</span>
                        <span css={css`color: var(--grey-3);`}>Name:</span>
                        <span>@</span>
                        <span css={css`color: var(--grey-3);`}>Value:</span>
                        <span>76.76.21.21</span>
                      </div>
                    </div>
                  </div>
                )}

                <div css={css`
                  background: var(--grey-2);
                  border-radius: 0.375rem;
                  padding: 0.75rem;
                  margin-bottom: 1rem;
                `}>
                  <p css={css`margin: 0 0 0.5rem 0; color: var(--grey-3); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;`}>
                    Where to add this
                  </p>
                  <ol css={css`
                    margin: 0;
                    padding-left: 1.25rem;
                    color: var(--grey-4);
                    font-size: 0.8rem;
                    line-height: 1.6;
                  `}>
                    <li>Go to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)</li>
                    <li>Find the DNS settings or DNS management page</li>
                    <li>Add a new record with the values above</li>
                    <li>Save and wait for propagation (usually 5-30 minutes)</li>
                  </ol>
                </div>

                <p css={css`margin: 0; font-size: 0.75rem; color: var(--grey-3);`}>
                  DNS changes typically take 5-30 minutes but can take up to 48 hours. Click &quot;Verify&quot; after updating your DNS.
                </p>
              </div>
            )}
          </div>

          {/* Custom branding section */}
          <div css={css`margin-bottom: 1rem;`}>
            <StyledLabel htmlFor="footer-text">Custom Footer Text</StyledLabel>
            <div css={css`display: flex; gap: 0.5rem;`}>
              <SmallInput
                id="footer-text"
                type="text"
                value={footerText}
                onChange={e => {
                  setFooterText(e.target.value)
                  setDomainError(null)
                  setDomainSuccess(null)
                }}
                placeholder="Made with Bublr"
                maxLength={100}
              />
              <button
                onClick={handleUpdateBranding}
                disabled={actionLoading}
                css={css`
                  background: var(--grey-5);
                  color: var(--grey-1);
                  border: none;
                  padding: 0.5rem 0.75rem;
                  border-radius: 0.5rem;
                  font-size: 0.8rem;
                  cursor: pointer;
                  white-space: nowrap;
                  opacity: ${actionLoading ? 0.5 : 1};

                  &:hover:not(:disabled) {
                    opacity: 0.8;
                  }
                `}
              >
                Save
              </button>
            </div>
            <p css={css`font-size: 0.75rem; color: var(--grey-3); margin-top: 0.5rem;`}>
              Replace &quot;Made with Bublr&quot; in your profile and post footers. Leave empty to hide it entirely.
            </p>
          </div>

          {/* Newsletter Template Section */}
          <NewsletterTemplateSection
            userId={userId}
            hasAccess={hasAccess}
            currentTemplate={subscriptionStatus?.newsletterTemplate}
            onError={setDomainError}
            onSuccess={setDomainSuccess}
          />

          {/* Subscription info */}
          <div css={css`
            background: var(--grey-1);
            border: 1px solid var(--grey-2);
            border-radius: 0.5rem;
            padding: 0.75rem;
            font-size: 0.8rem;
            color: var(--grey-4);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
          `}>
            <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
              <CheckCircledIcon css={css`color: #22c55e; flex-shrink: 0;`} />
              <span>Subscription is active</span>
            </div>
            <button
              onClick={async () => {
                setActionLoading(true)
                setDomainError(null)
                try {
                  const res = await fetch('/api/subscription/portal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId }),
                  })
                  const data = await res.json()
                  if (data.portalUrl) {
                    window.open(data.portalUrl, '_blank')
                  } else {
                    setDomainError(data.error || 'Failed to open billing portal')
                  }
                } catch (err) {
                  setDomainError('Failed to open billing portal')
                } finally {
                  setActionLoading(false)
                }
              }}
              disabled={actionLoading}
              css={css`
                background: none;
                color: var(--grey-3);
                border: 1px solid var(--grey-2);
                padding: 0.35rem 0.6rem;
                border-radius: 0.375rem;
                font-size: 0.75rem;
                cursor: pointer;
                white-space: nowrap;

                &:hover:not(:disabled) {
                  border-color: var(--grey-3);
                  color: var(--grey-4);
                }
              `}
            >
              Manage Billing
            </button>
          </div>
        </>
      )}

      {/* Error/Success messages */}
      {domainError && (
        <p css={css`
          font-size: 0.8rem;
          color: #dc2626;
          margin-top: 0.75rem;
          padding: 0.5rem;
          background: #fef2f2;
          border-radius: 0.25rem;
        `}>
          {domainError}
        </p>
      )}
      {domainSuccess && (
        <p css={css`
          font-size: 0.8rem;
          color: #166534;
          margin-top: 0.75rem;
          padding: 0.5rem;
          background: #f0fdf4;
          border-radius: 0.25rem;
        `}>
          {domainSuccess}
        </p>
      )}
    </>
  )
}

function Editor({ user }) {
  const [clientUser, setClientUser] = useState({
    name: '',
    displayName: '',
    about: '',
    link: '',
    posts: [],
    photo: '',
    readingList: [],
    socialLinks: {
      github: '',
      twitter: '',
      instagram: '',
      linkedin: '',
      youtube: '',
      email: '',
    },
    skills: [],
    skillsSectionTitle: '',
    customSections: [],
    sectionOrder: ['skills', 'writing', 'custom'],
    statsVisibility: { followers: true, following: true, subscribers: true },
    statsOrder: ['followers', 'following', 'subscribers'],
    statsStyle: 'separator',
    buttonsVisibility: { follow: true, newsletter: true },
    buttonsOrder: ['follow', 'newsletter'],
  })
  const [usernameErr, setUsernameErr] = useState(null)
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved', 'saving', 'unsaved'
  const saveTimeoutRef = useRef(null)
  const isInitialMount = useRef(true)

  useEffect(() => {
    setClientUser({
      ...user,
      socialLinks: user.socialLinks || {
        github: '',
        twitter: '',
        instagram: '',
        linkedin: '',
        youtube: '',
        email: '',
      },
      skills: user.skills || [],
      skillsSectionTitle: user.skillsSectionTitle || '',
      customSections: user.customSections || [],
      sectionOrder: user.sectionOrder || ['skills', 'writing', 'custom'],
      statsVisibility: user.statsVisibility || { followers: true, following: true, subscribers: true },
      statsOrder: user.statsOrder || ['followers', 'following', 'subscribers'],
      statsStyle: user.statsStyle || 'separator',
      buttonsVisibility: user.buttonsVisibility || { follow: true, newsletter: true },
      buttonsOrder: user.buttonsOrder || ['follow', 'newsletter'],
    })
  }, [user])

  const DEFAULT_SECTION_ORDER = ['skills', 'writing', 'custom']

  const SECTION_LABELS = {
    skills: 'Skills & Tags',
    writing: 'Writing',
    custom: 'Custom Sections',
  }

  const DEFAULT_STATS_ORDER = ['followers', 'following', 'subscribers']

  const STATS_LABELS = {
    followers: 'Followers',
    following: 'Following',
    subscribers: 'Subscribers',
  }

  const DEFAULT_BUTTONS_ORDER = ['follow', 'newsletter']

  const BUTTONS_LABELS = {
    follow: 'Follow Button',
    newsletter: 'Newsletter Button',
  }

  const moveSectionUp = (index) => {
    if (index === 0) return
    const newOrder = [...(clientUser.sectionOrder || DEFAULT_SECTION_ORDER)]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    setClientUser(prev => ({ ...prev, sectionOrder: newOrder }))
  }

  const moveSectionDown = (index) => {
    const order = clientUser.sectionOrder || DEFAULT_SECTION_ORDER
    if (index === order.length - 1) return
    const newOrder = [...order]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    setClientUser(prev => ({ ...prev, sectionOrder: newOrder }))
  }

  // Drag and drop state
  const [draggedSection, setDraggedSection] = useState(null)
  const [dragOverSection, setDragOverSection] = useState(null)

  const handleDragStart = (e, section) => {
    setDraggedSection(section)
    e.dataTransfer.effectAllowed = 'move'
    // Make the drag image semi-transparent
    e.target.style.opacity = '0.5'
  }

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1'
    setDraggedSection(null)
    setDragOverSection(null)
  }

  const handleDragOver = (e, section) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (section !== draggedSection) {
      setDragOverSection(section)
    }
  }

  const handleDragLeave = () => {
    setDragOverSection(null)
  }

  const handleDrop = (e, targetSection) => {
    e.preventDefault()
    if (!draggedSection || draggedSection === targetSection) return

    const order = clientUser.sectionOrder || DEFAULT_SECTION_ORDER
    const newOrder = [...order]
    const draggedIndex = newOrder.indexOf(draggedSection)
    const targetIndex = newOrder.indexOf(targetSection)

    // Remove dragged item and insert at target position
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedSection)

    setClientUser(prev => ({ ...prev, sectionOrder: newOrder }))
    setDraggedSection(null)
    setDragOverSection(null)
  }

  // Stats visibility and ordering functions
  const toggleStatVisibility = (stat) => {
    setClientUser(prev => ({
      ...prev,
      statsVisibility: {
        ...prev.statsVisibility,
        [stat]: !prev.statsVisibility[stat],
      },
    }))
  }

  const moveStatUp = (index) => {
    if (index === 0) return
    const newOrder = [...(clientUser.statsOrder || DEFAULT_STATS_ORDER)]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    setClientUser(prev => ({ ...prev, statsOrder: newOrder }))
  }

  const moveStatDown = (index) => {
    const order = clientUser.statsOrder || DEFAULT_STATS_ORDER
    if (index === order.length - 1) return
    const newOrder = [...order]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    setClientUser(prev => ({ ...prev, statsOrder: newOrder }))
  }

  // Drag and drop state for stats
  const [draggedStat, setDraggedStat] = useState(null)
  const [dragOverStat, setDragOverStat] = useState(null)

  const handleStatDragStart = (e, stat) => {
    setDraggedStat(stat)
    e.dataTransfer.effectAllowed = 'move'
    e.target.style.opacity = '0.5'
  }

  const handleStatDragEnd = (e) => {
    e.target.style.opacity = '1'
    setDraggedStat(null)
    setDragOverStat(null)
  }

  const handleStatDragOver = (e, stat) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (stat !== draggedStat) {
      setDragOverStat(stat)
    }
  }

  const handleStatDragLeave = () => {
    setDragOverStat(null)
  }

  const handleStatDrop = (e, targetStat) => {
    e.preventDefault()
    if (!draggedStat || draggedStat === targetStat) return

    const order = clientUser.statsOrder || DEFAULT_STATS_ORDER
    const newOrder = [...order]
    const draggedIndex = newOrder.indexOf(draggedStat)
    const targetIndex = newOrder.indexOf(targetStat)

    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedStat)

    setClientUser(prev => ({ ...prev, statsOrder: newOrder }))
    setDraggedStat(null)
    setDragOverStat(null)
  }

  // Buttons visibility and ordering functions
  const toggleButtonVisibility = (button) => {
    setClientUser(prev => ({
      ...prev,
      buttonsVisibility: {
        ...prev.buttonsVisibility,
        [button]: !prev.buttonsVisibility[button],
      },
    }))
  }

  const moveButtonUp = (index) => {
    if (index === 0) return
    const newOrder = [...(clientUser.buttonsOrder || DEFAULT_BUTTONS_ORDER)]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    setClientUser(prev => ({ ...prev, buttonsOrder: newOrder }))
  }

  const moveButtonDown = (index) => {
    const order = clientUser.buttonsOrder || DEFAULT_BUTTONS_ORDER
    if (index === order.length - 1) return
    const newOrder = [...order]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    setClientUser(prev => ({ ...prev, buttonsOrder: newOrder }))
  }

  // Drag and drop state for buttons
  const [draggedButton, setDraggedButton] = useState(null)
  const [dragOverButton, setDragOverButton] = useState(null)

  const handleButtonDragStart = (e, button) => {
    setDraggedButton(button)
    e.dataTransfer.effectAllowed = 'move'
    e.target.style.opacity = '0.5'
  }

  const handleButtonDragEnd = (e) => {
    e.target.style.opacity = '1'
    setDraggedButton(null)
    setDragOverButton(null)
  }

  const handleButtonDragOver = (e, button) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (button !== draggedButton) {
      setDragOverButton(button)
    }
  }

  const handleButtonDragLeave = () => {
    setDragOverButton(null)
  }

  const handleButtonDrop = (e, targetButton) => {
    e.preventDefault()
    if (!draggedButton || draggedButton === targetButton) return

    const order = clientUser.buttonsOrder || DEFAULT_BUTTONS_ORDER
    const newOrder = [...order]
    const draggedIndex = newOrder.indexOf(draggedButton)
    const targetIndex = newOrder.indexOf(targetButton)

    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedButton)

    setClientUser(prev => ({ ...prev, buttonsOrder: newOrder }))
    setDraggedButton(null)
    setDragOverButton(null)
  }

  const updateSocialLink = (platform, value) => {
    setClientUser(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [platform]: value,
      },
    }))
  }

  const addCustomSection = () => {
    setClientUser(prev => ({
      ...prev,
      customSections: [
        ...prev.customSections,
        { title: '', content: '' },
      ],
    }))
  }

  const updateCustomSection = (index, field, value) => {
    setClientUser(prev => ({
      ...prev,
      customSections: prev.customSections.map((section, i) =>
        i === index ? { ...section, [field]: value } : section
      ),
    }))
  }

  const removeCustomSection = index => {
    setClientUser(prev => ({
      ...prev,
      customSections: prev.customSections.filter((_, i) => i !== index),
    }))
  }

  const hasChanges = useCallback(() => {
    const originalSocialLinks = user.socialLinks || {}
    const originalSkills = user.skills || []
    const originalSkillsSectionTitle = user.skillsSectionTitle || ''
    const originalCustomSections = user.customSections || []
    const originalSectionOrder = user.sectionOrder || ['skills', 'writing', 'custom']
    const originalStatsVisibility = user.statsVisibility || { followers: true, following: true, subscribers: true }
    const originalStatsOrder = user.statsOrder || ['followers', 'following', 'subscribers']
    const originalStatsStyle = user.statsStyle || 'separator'
    const originalButtonsVisibility = user.buttonsVisibility || { follow: true, newsletter: true }
    const originalButtonsOrder = user.buttonsOrder || ['follow', 'newsletter']

    return (
      user.name !== clientUser.name ||
      user.displayName !== clientUser.displayName ||
      user.about !== clientUser.about ||
      user.link !== clientUser.link ||
      user.photo !== clientUser.photo ||
      JSON.stringify(originalSocialLinks) !== JSON.stringify(clientUser.socialLinks) ||
      JSON.stringify(originalSkills) !== JSON.stringify(clientUser.skills) ||
      originalSkillsSectionTitle !== clientUser.skillsSectionTitle ||
      JSON.stringify(originalCustomSections) !== JSON.stringify(clientUser.customSections) ||
      JSON.stringify(originalSectionOrder) !== JSON.stringify(clientUser.sectionOrder) ||
      JSON.stringify(originalStatsVisibility) !== JSON.stringify(clientUser.statsVisibility) ||
      JSON.stringify(originalStatsOrder) !== JSON.stringify(clientUser.statsOrder) ||
      originalStatsStyle !== clientUser.statsStyle ||
      JSON.stringify(originalButtonsVisibility) !== JSON.stringify(clientUser.buttonsVisibility) ||
      JSON.stringify(originalButtonsOrder) !== JSON.stringify(clientUser.buttonsOrder)
    )
  }, [user, clientUser])

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    // Don't auto-save if username changed (requires validation)
    if (clientUser.name !== user.name) {
      return
    }

    if (!hasChanges()) return

    setSaveStatus('saving')
    try {
      let toSave = { ...clientUser }
      delete toSave.id
      await firestore.collection('users').doc(user.id).set(toSave)
      setSaveStatus('saved')
    } catch (err) {
      console.error('Auto-save error:', err)
      setSaveStatus('unsaved')
    }
  }, [clientUser, user, hasChanges])

  // Trigger auto-save when clientUser changes (with debounce)
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Don't auto-save if there are no changes
    if (!hasChanges()) return

    // Don't auto-save username changes
    if (clientUser.name !== user.name) {
      setSaveStatus('unsaved')
      return
    }

    setSaveStatus('unsaved')

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save (1 second debounce)
    saveTimeoutRef.current = setTimeout(() => {
      performAutoSave()
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [clientUser, user.name, hasChanges, performAutoSave])

  return (
    <>
      <div
        css={css`
          font-size: 0.9rem;

          input,
          textarea {
            width: 100%;
          }

          textarea {
            min-height: 8em;
            resize: none;
          }
        `}
      >
        {/* Basic Info Section */}
        <SectionHeader>Basic Info</SectionHeader>

        {/* Profile Picture Upload */}
        <ProfilePictureUpload
          currentPhoto={clientUser.photo}
          onPhotoChange={(newPhotoUrl) => {
            setClientUser(prev => ({ ...prev, photo: newPhotoUrl }))
          }}
        />

        <div css={css`margin-bottom: 1.25rem;`}>
          <StyledLabel htmlFor="profile-display-name">Display Name</StyledLabel>
          <Input
            id="profile-display-name"
            type="text"
            value={clientUser.displayName}
            onChange={e =>
              setClientUser(prevUser => ({
                ...prevUser,
                displayName: e.target.value,
              }))
            }
          />
        </div>

        <div css={css`margin-bottom: 1.25rem;`}>
          <StyledLabel htmlFor="profile-username">Username</StyledLabel>
          <Input
            id="profile-username"
            type="text"
            value={clientUser.name}
            onChange={e => {
              setUsernameErr(false)
              setClientUser(prevUser => ({
                ...prevUser,
                name: e.target.value,
              }))
            }}
          />
          {usernameErr !== null && (
            <p
              css={css`
                font-size: 0.85rem;
                color: #e55050;
                margin-top: 0.5rem;
              `}
            >
              {usernameErr}
            </p>
          )}
        </div>

        <div css={css`margin-bottom: 1.25rem;`}>
          <StyledLabel htmlFor="profile-about">About</StyledLabel>
          <Textarea
            id="profile-about"
            value={clientUser.about}
            onChange={e =>
              setClientUser(prevUser => ({
                ...prevUser,
                about: e.target.value,
              }))
            }
            placeholder="Tell people about yourself..."
          />
        </div>

        <div css={css`margin-bottom: 1.25rem;`}>
          <StyledLabel htmlFor="profile-link">Website</StyledLabel>
          <Input
            id="profile-link"
            type="text"
            value={clientUser.link || ''}
            onChange={e =>
              setClientUser(prevUser => ({
                ...prevUser,
                link: e.target.value,
              }))
            }
            placeholder="yourwebsite.com"
          />
        </div>

        {/* Social Links Section */}
        <SectionHeader>Social Links</SectionHeader>

        <div css={css`
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;

          @media (max-width: 500px) {
            grid-template-columns: 1fr;
          }
        `}>
          <div>
            <StyledLabel htmlFor="social-github">GitHub</StyledLabel>
            <SmallInput
              id="social-github"
              type="text"
              value={clientUser.socialLinks?.github || ''}
              onChange={e => updateSocialLink('github', e.target.value)}
              placeholder="username"
            />
          </div>

          <div>
            <StyledLabel htmlFor="social-twitter">Twitter / X</StyledLabel>
            <SmallInput
              id="social-twitter"
              type="text"
              value={clientUser.socialLinks?.twitter || ''}
              onChange={e => updateSocialLink('twitter', e.target.value)}
              placeholder="username"
            />
          </div>

          <div>
            <StyledLabel htmlFor="social-instagram">Instagram</StyledLabel>
            <SmallInput
              id="social-instagram"
              type="text"
              value={clientUser.socialLinks?.instagram || ''}
              onChange={e => updateSocialLink('instagram', e.target.value)}
              placeholder="username"
            />
          </div>

          <div>
            <StyledLabel htmlFor="social-linkedin">LinkedIn</StyledLabel>
            <SmallInput
              id="social-linkedin"
              type="text"
              value={clientUser.socialLinks?.linkedin || ''}
              onChange={e => updateSocialLink('linkedin', e.target.value)}
              placeholder="username"
            />
          </div>

          <div>
            <StyledLabel htmlFor="social-youtube">YouTube</StyledLabel>
            <SmallInput
              id="social-youtube"
              type="text"
              value={clientUser.socialLinks?.youtube || ''}
              onChange={e => updateSocialLink('youtube', e.target.value)}
              placeholder="@handle"
            />
          </div>

          <div>
            <StyledLabel htmlFor="social-email">Email</StyledLabel>
            <SmallInput
              id="social-email"
              type="email"
              value={clientUser.socialLinks?.email || ''}
              onChange={e => updateSocialLink('email', e.target.value)}
              placeholder="you@email.com"
            />
          </div>
        </div>

        {/* Skills/Tags Section */}
        <SectionHeader>Skills & Tags</SectionHeader>

        <div css={css`margin-bottom: 1.25rem;`}>
          <StyledLabel htmlFor="skills-section-title">Section Title</StyledLabel>
          <SmallInput
            id="skills-section-title"
            type="text"
            value={clientUser.skillsSectionTitle || ''}
            onChange={e =>
              setClientUser(prev => ({
                ...prev,
                skillsSectionTitle: e.target.value,
              }))
            }
            placeholder="What I work with"
          />
          <p css={css`
            font-size: 0.75rem;
            color: var(--grey-3);
            margin-top: 0.5rem;
          `}>
            Customize the title for your skills section (default: "What I work with")
          </p>
        </div>

        <div css={css`margin-bottom: 1.25rem;`}>
          <StyledLabel>Skills</StyledLabel>
          <TagInput
            tags={clientUser.skills || []}
            onChange={skills => setClientUser(prev => ({ ...prev, skills }))}
            placeholder="Type a skill and press Enter..."
          />
          <p css={css`
            font-size: 0.75rem;
            color: var(--grey-3);
            margin-top: 0.5rem;
          `}>
            Press Enter or comma to add a tag. Backspace to remove.
          </p>
        </div>

        {/* Custom Sections */}
        <SectionHeader>Custom Sections</SectionHeader>

        <p css={css`
          font-size: 0.8rem;
          color: var(--grey-3);
          margin-bottom: 1rem;
        `}>
          Add custom sections to your profile page (e.g., "Currently working on", "Support me", etc.)
        </p>

        {clientUser.customSections?.map((section, index) => (
          <div
            key={index}
            css={css`
              background: var(--grey-1);
              border: 1px solid var(--grey-2);
              border-radius: 0.5rem;
              padding: 1rem;
              margin-bottom: 1rem;
              position: relative;
            `}
          >
            <button
              type="button"
              onClick={() => removeCustomSection(index)}
              css={css`
                position: absolute;
                top: 0.75rem;
                right: 0.75rem;
                background: none;
                border: none;
                cursor: pointer;
                color: var(--grey-3);
                padding: 0.25rem;
                display: flex;
                align-items: center;
                &:hover {
                  color: #e55050;
                }
              `}
            >
              <TrashIcon width={14} height={14} />
            </button>

            <div css={css`margin-bottom: 0.75rem;`}>
              <StyledLabel>Section Title</StyledLabel>
              <SmallInput
                type="text"
                value={section.title}
                onChange={e => updateCustomSection(index, 'title', e.target.value)}
                placeholder="e.g., What I'm working on"
              />
            </div>

            <div>
              <StyledLabel>Content</StyledLabel>
              <Textarea
                value={section.content}
                onChange={e => updateCustomSection(index, 'content', e.target.value)}
                placeholder="Write your section content..."
                css={css`
                  min-height: 5em;
                `}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addCustomSection}
          css={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: none;
            border: 1px dashed var(--grey-2);
            border-radius: 0.5rem;
            padding: 0.75rem 1rem;
            color: var(--grey-3);
            cursor: pointer;
            width: 100%;
            justify-content: center;
            font-size: 0.85rem;
            transition: all 0.2s ease;

            &:hover {
              border-color: var(--grey-3);
              color: var(--grey-4);
            }
          `}
        >
          <PlusIcon width={14} height={14} />
          Add Section
        </button>

        {/* Profile Stats Section */}
        <SectionHeader>Profile Stats</SectionHeader>

        <p css={css`
          font-size: 0.8rem;
          color: var(--grey-3);
          margin-bottom: 1rem;
        `}>
          Choose which stats to show on your profile and their order
        </p>

        <div css={css`
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        `}>
          {(clientUser.statsOrder || DEFAULT_STATS_ORDER).map((stat, index) => (
            <div
              key={stat}
              draggable
              onDragStart={(e) => handleStatDragStart(e, stat)}
              onDragEnd={handleStatDragEnd}
              onDragOver={(e) => handleStatDragOver(e, stat)}
              onDragLeave={handleStatDragLeave}
              onDrop={(e) => handleStatDrop(e, stat)}
              css={css`
                display: flex;
                align-items: center;
                background: ${dragOverStat === stat ? 'var(--grey-2)' : 'var(--grey-1)'};
                border: 1px solid ${dragOverStat === stat ? 'var(--grey-3)' : 'var(--grey-2)'};
                border-radius: 0.5rem;
                padding: 0.5rem 0.75rem;
                transition: all 0.15s ease;
                cursor: grab;
                user-select: none;
                opacity: ${clientUser.statsVisibility?.[stat] === false ? 0.5 : 1};

                &:hover {
                  border-color: var(--grey-3);
                  background: var(--grey-2);
                }

                &:active {
                  cursor: grabbing;
                }
              `}
            >
              {/* Drag handle */}
              <span css={css`
                color: var(--grey-3);
                margin-right: 0.75rem;
                display: flex;
                align-items: center;
              `}>
                <DragHandleDots2Icon width={16} height={16} />
              </span>

              {/* Stat label */}
              <span css={css`
                font-size: 0.85rem;
                color: var(--grey-4);
                flex: 1;
              `}>
                {STATS_LABELS[stat]}
              </span>

              {/* Visibility toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleStatVisibility(stat)
                }}
                css={css`
                  background: ${clientUser.statsVisibility?.[stat] !== false ? 'var(--grey-4)' : 'var(--grey-2)'};
                  border: none;
                  border-radius: 10px;
                  width: 36px;
                  height: 20px;
                  cursor: pointer;
                  position: relative;
                  transition: all 0.2s ease;
                  margin-right: 0.5rem;

                  &::after {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: ${clientUser.statsVisibility?.[stat] !== false ? '18px' : '2px'};
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: 50%;
                    transition: left 0.2s ease;
                  }
                `}
                title={clientUser.statsVisibility?.[stat] !== false ? 'Click to hide' : 'Click to show'}
              />

              {/* Move buttons */}
              <div css={css`
                display: flex;
                gap: 0.125rem;
              `}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveStatUp(index)
                  }}
                  disabled={index === 0}
                  css={css`
                    background: ${index === 0 ? 'none' : 'var(--grey-2)'};
                    border: none;
                    border-radius: 0.25rem;
                    cursor: ${index === 0 ? 'not-allowed' : 'pointer'};
                    padding: 0.35rem;
                    color: ${index === 0 ? 'var(--grey-2)' : 'var(--grey-3)'};
                    display: flex;
                    align-items: center;
                    transition: all 0.15s ease;

                    &:hover:not(:disabled) {
                      background: var(--grey-3);
                      color: var(--grey-1);
                    }
                  `}
                >
                  <ChevronUpIcon width={14} height={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveStatDown(index)
                  }}
                  disabled={index === (clientUser.statsOrder || DEFAULT_STATS_ORDER).length - 1}
                  css={css`
                    background: ${index === (clientUser.statsOrder || DEFAULT_STATS_ORDER).length - 1 ? 'none' : 'var(--grey-2)'};
                    border: none;
                    border-radius: 0.25rem;
                    cursor: ${index === (clientUser.statsOrder || DEFAULT_STATS_ORDER).length - 1 ? 'not-allowed' : 'pointer'};
                    padding: 0.35rem;
                    color: ${index === (clientUser.statsOrder || DEFAULT_STATS_ORDER).length - 1 ? 'var(--grey-2)' : 'var(--grey-3)'};
                    display: flex;
                    align-items: center;
                    transition: all 0.15s ease;

                    &:hover:not(:disabled) {
                      background: var(--grey-3);
                      color: var(--grey-1);
                    }
                  `}
                >
                  <ChevronDownIcon width={14} height={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Stats Display Style */}
        <div css={css`margin-top: 1.25rem;`}>
          <StyledLabel>Display Style</StyledLabel>
          <div css={css`
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
          `}>
            {[
              { value: 'separator', label: '12 followers // 15 following', desc: 'With separator' },
              { value: 'inline', label: '12 followers  15 following', desc: 'Inline' },
              { value: 'stacked', label: '12 / followers', desc: 'Stacked' },
            ].map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => setClientUser(prev => ({ ...prev, statsStyle: style.value }))}
                css={css`
                  flex: 1;
                  min-width: 120px;
                  padding: 0.75rem 0.5rem;
                  background: ${clientUser.statsStyle === style.value ? 'var(--grey-4)' : 'var(--grey-1)'};
                  color: ${clientUser.statsStyle === style.value ? 'white' : 'var(--grey-4)'};
                  border: 1px solid ${clientUser.statsStyle === style.value ? 'var(--grey-4)' : 'var(--grey-2)'};
                  border-radius: 0.5rem;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  text-align: center;

                  &:hover {
                    border-color: var(--grey-3);
                  }
                `}
              >
                <span css={css`
                  font-size: 0.7rem;
                  display: block;
                  opacity: 0.7;
                  margin-bottom: 0.25rem;
                `}>
                  {style.desc}
                </span>
                <span css={css`
                  font-size: 0.75rem;
                  font-family: monospace;
                `}>
                  {style.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Profile Buttons Section */}
        <SectionHeader>Profile Buttons</SectionHeader>

        <p css={css`
          font-size: 0.8rem;
          color: var(--grey-3);
          margin-bottom: 1rem;
        `}>
          Choose which buttons to show and their order
        </p>

        <div css={css`
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        `}>
          {(clientUser.buttonsOrder || DEFAULT_BUTTONS_ORDER).map((button, index) => (
            <div
              key={button}
              draggable
              onDragStart={(e) => handleButtonDragStart(e, button)}
              onDragEnd={handleButtonDragEnd}
              onDragOver={(e) => handleButtonDragOver(e, button)}
              onDragLeave={handleButtonDragLeave}
              onDrop={(e) => handleButtonDrop(e, button)}
              css={css`
                display: flex;
                align-items: center;
                background: ${dragOverButton === button ? 'var(--grey-2)' : 'var(--grey-1)'};
                border: 1px solid ${dragOverButton === button ? 'var(--grey-3)' : 'var(--grey-2)'};
                border-radius: 0.5rem;
                padding: 0.5rem 0.75rem;
                transition: all 0.15s ease;
                cursor: grab;
                user-select: none;
                opacity: ${clientUser.buttonsVisibility?.[button] === false ? 0.5 : 1};

                &:hover {
                  border-color: var(--grey-3);
                  background: var(--grey-2);
                }

                &:active {
                  cursor: grabbing;
                }
              `}
            >
              {/* Drag handle */}
              <span css={css`
                color: var(--grey-3);
                margin-right: 0.75rem;
                display: flex;
                align-items: center;
              `}>
                <DragHandleDots2Icon width={16} height={16} />
              </span>

              {/* Button label */}
              <span css={css`
                font-size: 0.85rem;
                color: var(--grey-4);
                flex: 1;
              `}>
                {BUTTONS_LABELS[button]}
              </span>

              {/* Visibility toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleButtonVisibility(button)
                }}
                css={css`
                  background: ${clientUser.buttonsVisibility?.[button] !== false ? 'var(--grey-4)' : 'var(--grey-2)'};
                  border: none;
                  border-radius: 10px;
                  width: 36px;
                  height: 20px;
                  cursor: pointer;
                  position: relative;
                  transition: all 0.2s ease;
                  margin-right: 0.5rem;

                  &::after {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: ${clientUser.buttonsVisibility?.[button] !== false ? '18px' : '2px'};
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: 50%;
                    transition: left 0.2s ease;
                  }
                `}
                title={clientUser.buttonsVisibility?.[button] !== false ? 'Click to hide' : 'Click to show'}
              />

              {/* Move buttons */}
              <div css={css`
                display: flex;
                gap: 0.125rem;
              `}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveButtonUp(index)
                  }}
                  disabled={index === 0}
                  css={css`
                    background: ${index === 0 ? 'none' : 'var(--grey-2)'};
                    border: none;
                    border-radius: 0.25rem;
                    cursor: ${index === 0 ? 'not-allowed' : 'pointer'};
                    padding: 0.35rem;
                    color: ${index === 0 ? 'var(--grey-2)' : 'var(--grey-3)'};
                    display: flex;
                    align-items: center;
                    transition: all 0.15s ease;

                    &:hover:not(:disabled) {
                      background: var(--grey-3);
                      color: var(--grey-1);
                    }
                  `}
                >
                  <ChevronUpIcon width={14} height={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveButtonDown(index)
                  }}
                  disabled={index === (clientUser.buttonsOrder || DEFAULT_BUTTONS_ORDER).length - 1}
                  css={css`
                    background: ${index === (clientUser.buttonsOrder || DEFAULT_BUTTONS_ORDER).length - 1 ? 'none' : 'var(--grey-2)'};
                    border: none;
                    border-radius: 0.25rem;
                    cursor: ${index === (clientUser.buttonsOrder || DEFAULT_BUTTONS_ORDER).length - 1 ? 'not-allowed' : 'pointer'};
                    padding: 0.35rem;
                    color: ${index === (clientUser.buttonsOrder || DEFAULT_BUTTONS_ORDER).length - 1 ? 'var(--grey-2)' : 'var(--grey-3)'};
                    display: flex;
                    align-items: center;
                    transition: all 0.15s ease;

                    &:hover:not(:disabled) {
                      background: var(--grey-3);
                      color: var(--grey-1);
                    }
                  `}
                >
                  <ChevronDownIcon width={14} height={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Layout Order Section */}
        <SectionHeader>Layout Order</SectionHeader>

        <p css={css`
          font-size: 0.8rem;
          color: var(--grey-3);
          margin-bottom: 1rem;
        `}>
          Drag to reorder sections on your profile page
        </p>

        <div css={css`
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        `}>
          {(clientUser.sectionOrder || DEFAULT_SECTION_ORDER).map((section, index) => (
            <div
              key={section}
              draggable
              onDragStart={(e) => handleDragStart(e, section)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, section)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, section)}
              css={css`
                display: flex;
                align-items: center;
                background: ${dragOverSection === section ? 'var(--grey-2)' : 'var(--grey-1)'};
                border: 1px solid ${dragOverSection === section ? 'var(--grey-3)' : 'var(--grey-2)'};
                border-radius: 0.5rem;
                padding: 0.5rem 0.75rem;
                transition: all 0.15s ease;
                cursor: grab;
                user-select: none;

                &:hover {
                  border-color: var(--grey-3);
                  background: var(--grey-2);
                }

                &:active {
                  cursor: grabbing;
                }
              `}
            >
              {/* Drag handle */}
              <span css={css`
                color: var(--grey-3);
                margin-right: 0.75rem;
                display: flex;
                align-items: center;
              `}>
                <DragHandleDots2Icon width={16} height={16} />
              </span>

              {/* Section label */}
              <span css={css`
                font-size: 0.85rem;
                color: var(--grey-4);
                flex: 1;
              `}>
                {SECTION_LABELS[section]}
              </span>

              {/* Move buttons */}
              <div css={css`
                display: flex;
                gap: 0.125rem;
              `}>
                <button
                  type="button"
                  onClick={() => moveSectionUp(index)}
                  disabled={index === 0}
                  css={css`
                    background: ${index === 0 ? 'none' : 'var(--grey-2)'};
                    border: none;
                    border-radius: 0.25rem;
                    cursor: ${index === 0 ? 'not-allowed' : 'pointer'};
                    padding: 0.35rem;
                    color: ${index === 0 ? 'var(--grey-2)' : 'var(--grey-3)'};
                    display: flex;
                    align-items: center;
                    transition: all 0.15s ease;

                    &:hover:not(:disabled) {
                      background: var(--grey-3);
                      color: var(--grey-1);
                    }
                  `}
                >
                  <ChevronUpIcon width={14} height={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSectionDown(index)}
                  disabled={index === (clientUser.sectionOrder || DEFAULT_SECTION_ORDER).length - 1}
                  css={css`
                    background: ${index === (clientUser.sectionOrder || DEFAULT_SECTION_ORDER).length - 1 ? 'none' : 'var(--grey-2)'};
                    border: none;
                    border-radius: 0.25rem;
                    cursor: ${index === (clientUser.sectionOrder || DEFAULT_SECTION_ORDER).length - 1 ? 'not-allowed' : 'pointer'};
                    padding: 0.35rem;
                    color: ${index === (clientUser.sectionOrder || DEFAULT_SECTION_ORDER).length - 1 ? 'var(--grey-2)' : 'var(--grey-3)'};
                    display: flex;
                    align-items: center;
                    transition: all 0.15s ease;

                    &:hover:not(:disabled) {
                      background: var(--grey-3);
                      color: var(--grey-1);
                    }
                  `}
                >
                  <ChevronDownIcon width={14} height={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Domain Section */}
      <CustomDomainSection userId={user.id} userName={user.name} />

      {/* Advanced Settings (API Keys) - Inline Expandable */}
      <ApiKeySection userId={user.id} />

      <div css={css`
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--grey-2);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `}>
        <p
          css={css`
            font-size: 0.8rem;
            color: var(--grey-3);
            word-wrap: break-word;

            a {
              text-decoration: none;
              color: inherit;
              font-style: italic;
              border-bottom: 1px dotted var(--grey-3);
            }
          `}
        >
          Preview:{' '}
          <a target="_blank" rel="noreferrer" href={`/${user.name}`}>
            bublr.life/{user.name}
          </a>
        </p>

        {/* Show save button only for username changes, otherwise show auto-save status */}
        {clientUser.name !== user.name ? (
          <Button
            css={css`font-size: 0.9rem;`}
            outline
            disabled={!hasChanges() || usernameErr}
            onClick={async () => {
              let nameClashing = await userWithNameExists(clientUser.name)
              if (nameClashing) {
                setUsernameErr('That username is in use already.')
                return
              } else if (clientUser.name === '') {
                setUsernameErr('Username cannot be empty.')
                return
              } else if (!clientUser.name.match(/^[a-z0-9-]+$/i)) {
                setUsernameErr(
                  'Username can only consist of letters (a-z,A-Z), numbers (0-9) and dashes (-).',
                )
                return
              } else if (clientUser.name === 'dashboard') {
                setUsernameErr('That username is reserved.')
                return
              }

              setSaveStatus('saving')
              let toSave = { ...clientUser }
              delete toSave.id
              await firestore.collection('users').doc(user.id).set(toSave)
              setUsernameErr(null)
              setSaveStatus('saved')
            }}
          >
            Save username
          </Button>
        ) : (
          <span
            css={css`
              font-size: 0.8rem;
              color: var(--grey-3);
              display: flex;
              align-items: center;
              gap: 0.4rem;
            `}
          >
            {saveStatus === 'saving' && (
              <>
                <span css={css`
                  width: 8px;
                  height: 8px;
                  border: 1.5px solid var(--grey-3);
                  border-bottom-color: transparent;
                  border-radius: 50%;
                  display: inline-block;
                  animation: spin 0.8s linear infinite;
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `} />
                Saving...
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                </svg>
                Saved
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <span css={css`
                  width: 6px;
                  height: 6px;
                  background: #f59e0b;
                  border-radius: 50%;
                  display: inline-block;
                `} />
                Unsaved
              </>
            )}
          </span>
        )}
      </div>
    </>
  )
}

function ProfileEditor({ uid, authEmail }) {
  const [user, userLoading, userError] = useDocumentData(
    firestore.doc(`users/${uid}`),
    {
      idField: 'id',
    },
  )

  if (userError) {
    return (
      <>
        <p>Oop, we&apos;ve had an error:</p>
        <pre>{JSON.stringify(userError)}</pre>
      </>
    )
  } else if (user) {
    // Pass authEmail to Editor so CustomDomainSection can use it
    return <Editor user={{ ...user, email: authEmail }} />
  }

  return <Spinner />
}

export default function ProfileSettingsModal(props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <props.Trigger />
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
          <Dialog.Title css={css`margin: 0;`}>Profile Settings</Dialog.Title>
          <Dialog.Description
            css={css`
              margin: 0.5rem 0 0 0;
              color: var(--grey-3);
              font-size: 0.9rem;
            `}
          >
            Customize your public profile page
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
          <ProfileEditor uid={props.uid} authEmail={props.email} />
        </div>

        <Dialog.Close
          as={IconButton}
          css={css`
            position: absolute;
            top: 1rem;
            right: 1rem;
          `}
        >
          <Cross2Icon />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  )
}
