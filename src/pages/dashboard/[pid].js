/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import { createPortal } from 'react-dom'
import { tinykeys } from 'tinykeys'
import { css } from '@emotion/react'
import { useEffect, useState, useRef, useCallback } from 'react'
import StarterKit from '@tiptap/starter-kit'
import router, { useRouter } from 'next/router'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useDocumentData } from 'react-firebase-hooks/firestore'
import {
  ArrowLeftIcon,
  Cross2Icon,
  DotsVerticalIcon,
  FontBoldIcon,
  FontItalicIcon,
  Link2Icon,
  LinkBreak2Icon,
  StrikethroughIcon,
  CodeIcon,
  HeadingIcon,
  ListBulletIcon,
  UnderlineIcon,
} from '@radix-ui/react-icons'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'

import Text from '@tiptap/extension-text'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { lowlight } from 'lowlight'

import * as Dialog from '@radix-ui/react-dialog'

import firebase, { auth, firestore } from '../../lib/firebase'
import { postWithUserIDAndSlugExists, removePostForUser } from '../../lib/db'

// Color palette for post dots (same as berrysauce)
const DOT_COLORS = [
  { color: '#cf52f2', name: 'Purple' },
  { color: '#6BCB77', name: 'Green' },
  { color: '#4D96FF', name: 'Blue' },
  { color: '#A66CFF', name: 'Violet' },
  { color: '#E23E57', name: 'Red' },
  { color: '#ff3e00', name: 'Orange' },
]

// Platform icons for import feature
const PlatformIcons = {
  medium: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
    </svg>
  ),
  substack: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
    </svg>
  ),
  blogger: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.976 24H2.024A2.024 2.024 0 010 21.976V2.024A2.024 2.024 0 012.024 0h19.952A2.024 2.024 0 0124 2.024v19.952A2.024 2.024 0 0121.976 24zM9.29 5.062a4.67 4.67 0 00-4.47 4.654v4.792a4.673 4.673 0 004.67 4.67h5.5a4.673 4.673 0 004.67-4.67v-3.57a1.6 1.6 0 00-1.6-1.6h-.86a1.29 1.29 0 01-1.29-1.29v-.238a2.755 2.755 0 00-2.752-2.748H9.29zm5.24 11.302H9.47a.939.939 0 010-1.876h5.06a.939.939 0 010 1.876zm0-4.085h-5.06a.939.939 0 010-1.876h5.06a.939.939 0 010 1.876z"/>
    </svg>
  ),
  hashnode: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.351 8.019l-6.37-6.37a5.63 5.63 0 00-7.962 0l-6.37 6.37a5.63 5.63 0 000 7.962l6.37 6.37a5.63 5.63 0 007.962 0l6.37-6.37a5.63 5.63 0 000-7.962zM12 15.953a3.953 3.953 0 110-7.906 3.953 3.953 0 010 7.906z"/>
    </svg>
  ),
  wordpress: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.46 17.477L6.91 8.058c.586-.028 1.114-.084 1.114-.084.524-.056.463-.836-.062-.808 0 0-1.578.124-2.597.124-.181 0-.395-.005-.624-.014A9.584 9.584 0 0112 2.413c2.666 0 5.09 1.082 6.84 2.834-.044-.003-.087-.008-.132-.008-.955 0-1.632.83-1.632 1.722 0 .8.463 1.478.954 2.278.371.646.804 1.475.804 2.673 0 .83-.319 1.79-.741 3.132l-.971 3.245-3.521-10.48c.586-.028 1.114-.084 1.114-.084.523-.056.462-.836-.063-.808 0 0-1.578.124-2.597.124-.108 0-.232-.003-.362-.007l3.786 11.29zM15.12 18.4l3.011-8.707c.562-1.407.75-2.533.75-3.535 0-.363-.024-.7-.068-1.013a9.55 9.55 0 011.37 4.958c0 3.69-1.997 6.909-4.963 8.647l-.1-.35zm6.457-8.297c.002-.137.003-.275.003-.414A9.578 9.578 0 0012 2.413c-.357 0-.707.02-1.052.058a9.578 9.578 0 0110.63 7.632z"/>
    </svg>
  ),
  ghost: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 4.873 2.903 9.067 7.077 10.953.124-.59.235-1.497.048-2.142-.169-.583-1.09-3.746-1.09-3.746s-.278-.557-.278-1.38c0-1.294.75-2.261 1.684-2.261.794 0 1.178.596 1.178 1.31 0 .799-.509 1.993-.771 3.1-.219.927.465 1.682 1.381 1.682 1.656 0 2.929-1.747 2.929-4.266 0-2.231-1.603-3.792-3.894-3.792-2.652 0-4.209 1.989-4.209 4.046 0 .8.309 1.661.694 2.128.077.092.088.173.065.266-.071.294-.228.927-.259 1.057-.041.169-.134.205-.31.123-1.157-.538-1.881-2.229-1.881-3.587 0-2.921 2.123-5.604 6.12-5.604 3.214 0 5.713 2.29 5.713 5.35 0 3.193-2.013 5.762-4.808 5.762-.939 0-1.821-.488-2.124-1.064l-.578 2.201c-.209.802-.774 1.808-1.152 2.42.867.268 1.785.413 2.74.413 6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
    </svg>
  ),
  devto: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6v4.36h.58c.37 0 .65-.08.84-.23.21-.17.31-.48.31-.95v-2c0-.47-.1-.78-.31-.95zm13.82-6.05H2.76A2.26 2.26 0 00.5 6.26v11.48A2.26 2.26 0 002.76 20h18.48a2.26 2.26 0 002.26-2.26V6.26A2.26 2.26 0 0021.24 4zM8.94 14.05c0 1.04-.54 1.82-1.75 1.82H4.87V8.13h2.32c1.21 0 1.75.78 1.75 1.82v4.1zm4.19-3.68H11.1v1.36h1.3v1.16H11.1v1.36h2.03v1.62H10.2a.98.98 0 01-.98-.98V9.01c0-.54.44-.98.98-.98h2.93v1.34zm5.09 4.56c-.48 1.15-1.37 1.3-1.92.85-.37-.3-.63-.74-.63-.74l-.97-4.88v5.71h-1.5V8.13h1.97l.8 4.65.85-4.65h1.98v7.63h-1.5v-5.7l-.97 4.87c-.05.24-.14.43-.11.43z"/>
    </svg>
  ),
}

import Input from '../../components/input'
import Spinner from '../../components/spinner'
import Container from '../../components/container'
import ModalOverlay from '../../components/modal-overlay'
import PostContainer from '../../components/post-container'
import VoiceInput from '../../components/voice-input'
import Button, { IconButton, LinkIconButton } from '../../components/button'
import FontPicker from '../../components/font-picker'
import { DEFAULT_FONTS } from '../../lib/fonts'

function SelectionMenu({ editor }) {
  const [editingLink, setEditingLink] = useState(false)
  const [url, setUrl] = useState('')

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 150 }}
      shouldShow={({ editor, view, state, oldState, from, to }) => {
        return editor.isActive('link') || state.selection.content().size > 0
      }}
      css={css`
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        max-width: 500px;

        border-radius: 0.5rem;
        box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
        background: var(--grey-5);
        color: var(--grey-1);
        padding: 0.5rem;
        transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;

        input {
          background: none;
          border: none;
          margin: 0;
          padding: 0.5rem;
          color: var(--grey-2);
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
          transition: color 0.2s ease;
        }

        input::placeholder {
          font-family: 'Inter', sans-serif;
          color: var(--grey-3);
          font-size: 0.8rem;
        }

        input:focus {
          outline: none;
          color: var(--grey-1);
        }

        button {
          margin: 0 0.25rem;
          background: none;
          border: none;
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 0.25rem;
          color: var(--grey-3);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          cursor: pointer;
        }

        button:hover {
          background: rgba(0, 0, 0, 0.1);
          color: var(--grey-1);
        }

        button:focus,
        button.is-active {
          color: var(--grey-1);
          background: rgba(0, 0, 0, 0.08);
        }

        html[data-theme='dark'] button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        html[data-theme='dark'] button.is-active {
          background: rgba(255, 255, 255, 0.15);
        }

        .separator {
          width: 1px;
          height: 1.25rem;
          background-color: var(--grey-3);
          margin: 0 0.25rem;
          opacity: 0.5;
        }
      `}
    >
      {editingLink ? (
        <>
          <button
            onClick={() => {
              setEditingLink(false)
            }}
            title="Back"
          >
            <ArrowLeftIcon />
          </button>
          <form
            onSubmit={e => {
              e.preventDefault()

              editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: url })
                .run()

              setEditingLink(false)
            }}
          >
            <input
              type="url"
              value={url}
              placeholder="https://example.com"
              onChange={e => {
                setUrl(e.target.value)
              }}
              autoFocus
            />
          </form>
          <button type="submit" title="Add link">
            <Link2Icon />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'is-active' : ''}
            title="Bold"
          >
            <FontBoldIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'is-active' : ''}
            title="Italic"
          >
            <FontItalicIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive('underline') ? 'is-active' : ''}
            title="Underline"
          >
            <UnderlineIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive('strike') ? 'is-active' : ''}
            title="Strikethrough"
          >
            <StrikethroughIcon />
          </button>
          
          <div className="separator"></div>
          
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
            title="Heading"
          >
            <HeadingIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'is-active' : ''}
            title="Bullet List"
          >
            <ListBulletIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive('codeBlock') ? 'is-active' : ''}
            title="Code Block"
          >
            <CodeIcon />
          </button>
          
          <div className="separator"></div>
          
          {editor.isActive('link') ? (
            <button onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
              <LinkBreak2Icon />
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingLink(true)
                setUrl('https://')
              }}
              title="Add Link"
            >
              <Link2Icon />
            </button>
          )}
        </>
      )}
    </BubbleMenu>
  )
}

// Funny spam messages
const SPAM_MESSAGES = [
  "Whoa there, spam-inator! We don't do that here.",
  "Nice try, but our AI has trust issues with this content.",
  "Houston, we have a spam problem.",
  "Our content detector said 'nope' to this one.",
  "This content triggered our spidey senses.",
  "Error 418: I'm a teapot, and I refuse to brew spam.",
]

// Medium Import Popup - same style as SpamPopup (berrysauce inspired)
function MediumImportPopup({ isOpen, onClose, onImport }) {
  const [mounted, setMounted] = useState(false)
  const [username, setUsername] = useState('')
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setUsername('')
      setArticles([])
      setError('')
      setSelectedArticle(null)
    }
  }, [isOpen])

  const fetchArticles = async () => {
    if (!username.trim()) {
      setError('Please enter a Medium username')
      return
    }

    setLoading(true)
    setError('')
    setArticles([])

    try {
      const response = await fetch('/api/medium/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch articles')
        return
      }

      if (data.articles.length === 0) {
        setError('No articles found for this user')
        return
      }

      setArticles(data.articles)
    } catch (err) {
      setError('Failed to connect to Medium')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!selectedArticle) return

    setImporting(true)
    try {
      const response = await fetch('/api/medium/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selectedArticle.content,
          title: selectedArticle.title,
        }),
      })

      const data = await response.json()

      if (data.success) {
        onImport({
          title: selectedArticle.title,
          content: data.content,
        })
        onClose()
      } else {
        setError('Failed to convert article')
      }
    } catch (err) {
      setError('Failed to import article')
    } finally {
      setImporting(false)
    }
  }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      css={css`
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        backdrop-filter: blur(2px);
      `}
      onClick={onClose}
    >
      <div
        css={css`
          background: var(--grey-1);
          border-radius: 8px;
          padding: 2rem;
          max-width: 420px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          border: 1px solid var(--grey-2);

          &::-webkit-scrollbar {
            display: none;
          }
          -ms-overflow-style: none;
          scrollbar-width: none;
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          css={css`
            font-weight: 500;
            font-size: 1rem;
            margin-bottom: 8px;
            color: var(--grey-5);
          `}
        >
          Import from Medium
        </p>

        <p
          css={css`
            color: var(--grey-3);
            font-size: 0.85rem;
            margin-bottom: 20px;
            line-height: 1.5;
          `}
        >
          Bring your Medium articles to Bublr. Enter your Medium username to fetch your latest posts.
        </p>

        {/* Username input */}
        <div
          css={css`
            margin-bottom: 16px;
          `}
        >
          <div
            css={css`
              display: flex;
              gap: 8px;
            `}
          >
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchArticles()}
              placeholder="@username"
              css={css`
                flex: 1;
                padding: 10px 14px;
                border: 1px solid var(--grey-2);
                border-radius: 4px;
                background: var(--grey-1);
                color: var(--grey-5);
                font-size: 0.9rem;
                outline: none;
                transition: border-color 0.2s ease;

                &:focus {
                  border-color: var(--grey-3);
                }

                &::placeholder {
                  color: var(--grey-3);
                }
              `}
            />
            <button
              onClick={fetchArticles}
              disabled={loading}
              css={css`
                padding: 10px 16px;
                background: var(--grey-5);
                color: var(--grey-1);
                border: none;
                border-radius: 4px;
                font-size: 0.85rem;
                cursor: pointer;
                transition: opacity 0.2s ease;

                &:hover:not(:disabled) {
                  opacity: 0.9;
                }

                &:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }
              `}
            >
              {loading ? 'Loading...' : 'Fetch'}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            css={css`
              border: 1px solid var(--grey-2);
              border-radius: 4px;
              padding: 10px 14px;
              margin-bottom: 16px;
            `}
          >
            <p
              css={css`
                color: #e55050;
                font-size: 0.85rem;
                margin: 0;
              `}
            >
              {error}
            </p>
          </div>
        )}

        {/* Articles list */}
        {articles.length > 0 && (
          <div
            css={css`
              margin-bottom: 16px;
            `}
          >
            <p
              css={css`
                font-size: 0.8rem;
                color: var(--grey-3);
                margin-bottom: 8px;
              `}
            >
              Select an article to import:
            </p>
            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 200px;
                overflow-y: auto;

                &::-webkit-scrollbar {
                  width: 4px;
                }
                &::-webkit-scrollbar-thumb {
                  background: var(--grey-2);
                  border-radius: 2px;
                }
              `}
            >
              {articles.map((article, index) => (
                <button
                  key={article.guid || index}
                  onClick={() => setSelectedArticle(article)}
                  css={css`
                    text-align: left;
                    padding: 10px 14px;
                    border: 1px solid ${selectedArticle === article ? 'var(--grey-4)' : 'var(--grey-2)'};
                    border-radius: 4px;
                    background: ${selectedArticle === article ? 'var(--grey-2)' : 'transparent'};
                    cursor: pointer;
                    transition: all 0.2s ease;

                    &:hover {
                      border-color: var(--grey-3);
                    }
                  `}
                >
                  <p
                    css={css`
                      font-size: 0.85rem;
                      color: var(--grey-5);
                      margin: 0 0 4px 0;
                      font-weight: 500;
                    `}
                  >
                    {article.title}
                  </p>
                  <p
                    css={css`
                      font-size: 0.75rem;
                      color: var(--grey-3);
                      margin: 0;
                    `}
                  >
                    {new Date(article.pubDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div
          css={css`
            display: flex;
            gap: 8px;
          `}
        >
          <button
            onClick={onClose}
            css={css`
              flex: 1;
              background: var(--grey-1);
              color: var(--grey-4);
              border: 1px solid var(--grey-2);
              padding: 10px 16px;
              border-radius: 4px;
              font-size: 0.9rem;
              cursor: pointer;
              transition: all 0.2s ease;

              &:hover {
                border-color: var(--grey-3);
                color: var(--grey-5);
              }
            `}
          >
            Cancel
          </button>
          {selectedArticle && (
            <button
              onClick={handleImport}
              disabled={importing}
              css={css`
                flex: 1;
                background: var(--grey-5);
                color: var(--grey-1);
                border: none;
                padding: 10px 16px;
                border-radius: 4px;
                font-size: 0.9rem;
                cursor: pointer;
                transition: opacity 0.2s ease;

                &:hover:not(:disabled) {
                  opacity: 0.9;
                }

                &:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }
              `}
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>

        {/* Attribution */}
        <p
          css={css`
            font-size: 0.7rem;
            color: var(--grey-3);
            margin-top: 16px;
            text-align: center;
          `}
        >
          GYD (Get Your Data) - Import your content from other platforms
        </p>
      </div>
    </div>,
    document.body
  )
}

// Custom spam popup component - berrysauce inspired clean design
function SpamPopup({ isOpen, onClose, reason, category }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const funnyMessage = SPAM_MESSAGES[Math.floor(Math.random() * SPAM_MESSAGES.length)]

  return createPortal(
    <div
      css={css`
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        backdrop-filter: blur(2px);
      `}
      onClick={onClose}
    >
      <div
        css={css`
          background: var(--grey-1);
          border-radius: 8px;
          padding: 2rem;
          max-width: 380px;
          width: 90%;
          border: 1px solid var(--grey-2);
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          css={css`
            font-weight: 500;
            font-size: 1rem;
            margin-bottom: 12px;
            color: var(--grey-5);
          `}
        >
          Post Not Published
        </p>

        <p
          css={css`
            color: var(--grey-3);
            font-size: 0.9rem;
            margin-bottom: 16px;
            line-height: 1.5;
          `}
        >
          {funnyMessage}
        </p>

        <div
          css={css`
            border: 1px solid var(--grey-2);
            border-radius: 4px;
            padding: 10px 14px;
            margin-bottom: 20px;
          `}
        >
          <p
            css={css`
              color: var(--grey-4);
              font-size: 0.85rem;
              margin: 0;
            `}
          >
            {reason || 'Content policy violation'}
          </p>
          {category && category !== 'none' && (
            <span
              css={css`
                display: inline-block;
                margin-top: 8px;
                font-size: 0.75rem;
                color: var(--grey-3);
                border: 1px solid var(--grey-2);
                border-radius: 4px;
                padding: 2px 8px;
              `}
            >
              {category}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          css={css`
            width: 100%;
            background: var(--grey-1);
            color: var(--grey-4);
            border: 1px solid var(--grey-2);
            padding: 10px 16px;
            border-radius: 4px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              border-color: var(--grey-3);
              color: var(--grey-5);
            }
          `}
        >
          Got it, I'll fix it
        </button>
      </div>
    </div>,
    document.body
  )
}

function Editor({ post }) {
  const [userdata] = useDocumentData(firestore.doc(`users/${post.author}`), {
    idField: 'id',
  })
  const [clientPost, setClientPost] = useState({
    title: '',
    content: '',
    slug: '',
    excerpt: '',
    published: true,
    dotColor: '',
  })

  const [slugErr, setSlugErr] = useState(false)
  const [slugValidating, setSlugValidating] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved', 'saving', 'unsaved'
  const [spamPopup, setSpamPopup] = useState({ isOpen: false, reason: '', category: '' })
  const [mediumImportOpen, setMediumImportOpen] = useState(false)
  const [settingsView, setSettingsView] = useState('settings') // 'settings', 'import', or 'import-articles'
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [importUsername, setImportUsername] = useState('')
  const [importArticles, setImportArticles] = useState([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [importing, setImporting] = useState(false)

  // Available import platforms
  const IMPORT_PLATFORMS = [
    { id: 'medium', name: 'Medium', color: '#000000', placeholder: '@username', description: 'Import your Medium articles' },
    { id: 'substack', name: 'Substack', color: '#FF6719', placeholder: 'newsletter-name', description: 'Import Substack newsletters' },
    { id: 'blogger', name: 'Blogger', color: '#FF5722', placeholder: 'blogname', description: 'Import from Blogspot' },
    { id: 'hashnode', name: 'Hashnode', color: '#2962FF', placeholder: 'username', description: 'Import Hashnode posts' },
    { id: 'wordpress', name: 'WordPress', color: '#21759B', placeholder: 'blogname', description: 'Import from WordPress.com' },
    { id: 'ghost', name: 'Ghost', color: '#15171A', placeholder: 'blog.example.com', description: 'Import from Ghost blogs' },
    { id: 'devto', name: 'DEV.to', color: '#0A0A0A', placeholder: 'username', description: 'Import DEV.to articles' },
  ]
  const saveTimeoutRef = useRef(null)
  const slugSaveTimeoutRef = useRef(null)
  const isInitialMount = useRef(true)

  useEffect(() => {
    setClientPost(post)
  }, [post])

  // Check if there are unsaved changes
  const hasChanges = useCallback(() => {
    return (
      post.title !== clientPost.title ||
      post.content !== clientPost.content ||
      post.excerpt !== clientPost.excerpt ||
      post.slug !== clientPost.slug ||
      post.published !== clientPost.published ||
      post.dotColor !== clientPost.dotColor
    )
  }, [post, clientPost])

  // Save function
  const saveChanges = useCallback(async () => {
    if (!hasChanges()) return

    setSaveStatus('saving')
    try {
      let toSave = {
        ...clientPost,
        lastEdited: firebase.firestore.Timestamp.now(),
      }
      delete toSave.id // since we get the id from the document not the data
      await firestore.collection('posts').doc(post.id).set(toSave)
      setSaveStatus('saved')
    } catch (err) {
      console.error('Save error:', err)
      setSaveStatus('unsaved')
    }
  }, [clientPost, post.id, hasChanges])

  // Validate and save slug with debouncing
  const validateAndSaveSlug = useCallback(async (newSlug) => {
    // Skip if slug hasn't changed from saved version
    if (newSlug === post.slug) {
      setSlugErr(false)
      setSlugValidating(false)
      return
    }

    // Quick validation for format
    if (!newSlug || !newSlug.match(/^[a-z0-9-]+$/i)) {
      setSlugErr(true)
      setSlugValidating(false)
      return
    }

    setSlugValidating(true)
    setSlugErr(false)

    try {
      // Check for duplicate slugs
      const slugClashing = await postWithUserIDAndSlugExists(post.author, newSlug)

      if (slugClashing) {
        setSlugErr(true)
        setSlugValidating(false)
        return
      }

      // Slug is valid, save it
      setSaveStatus('saving')
      await firestore.collection('posts').doc(post.id).update({
        slug: newSlug,
        lastEdited: firebase.firestore.Timestamp.now(),
      })
      setSaveStatus('saved')
      setSlugValidating(false)
    } catch (err) {
      console.error('Slug save error:', err)
      setSlugErr(true)
      setSlugValidating(false)
      setSaveStatus('unsaved')
    }
  }, [post.slug, post.author, post.id])

  // Auto-save effect for slug changes
  useEffect(() => {
    // Skip if slug hasn't changed
    if (clientPost.slug === post.slug) return

    // Clear existing slug timeout
    if (slugSaveTimeoutRef.current) {
      clearTimeout(slugSaveTimeoutRef.current)
    }

    // Debounce slug validation and save (800ms for faster feedback)
    slugSaveTimeoutRef.current = setTimeout(() => {
      validateAndSaveSlug(clientPost.slug)
    }, 800)

    return () => {
      if (slugSaveTimeoutRef.current) {
        clearTimeout(slugSaveTimeoutRef.current)
      }
    }
  }, [clientPost.slug, post.slug, validateAndSaveSlug])

  // Auto-save effect for non-slug changes
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Check for non-slug changes only
    const hasNonSlugChanges =
      post.title !== clientPost.title ||
      post.content !== clientPost.content ||
      post.excerpt !== clientPost.excerpt ||
      post.published !== clientPost.published ||
      post.dotColor !== clientPost.dotColor

    if (!hasNonSlugChanges) return

    setSaveStatus('unsaved')

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save (1.5 second debounce for content)
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges()
    }, 1500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [clientPost, post, saveChanges])

  useEffect(() => {
    let unsubscribe = tinykeys(window, {
      '$mod+KeyS': e => {
        e.preventDefault()
        saveChanges()
      },
    })

    return () => {
      unsubscribe()
    }
  }, [saveChanges])

  // Handle fetching articles from selected platform
  const handleFetchArticles = async () => {
    if (!selectedPlatform) {
      setImportError('Please select a platform')
      return
    }

    if (!importUsername.trim()) {
      setImportError(`Please enter your ${selectedPlatform.name} username/URL`)
      return
    }

    setImportLoading(true)
    setImportError('')
    setImportArticles([])

    try {
      const response = await fetch('/api/import/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform.id,
          username: importUsername.trim()
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setImportError(data.error || `Failed to fetch ${selectedPlatform.name} articles`)
        return
      }

      if (data.articles.length === 0) {
        setImportError('No articles found. Make sure the blog is public.')
        return
      }

      setImportArticles(data.articles)
      setSettingsView('import-articles')
    } catch (err) {
      setImportError(`Failed to connect to ${selectedPlatform.name}`)
    } finally {
      setImportLoading(false)
    }
  }

  // Handle importing selected article
  const handleImportArticle = async () => {
    if (!selectedArticle || !selectedPlatform) return

    setImporting(true)
    try {
      const response = await fetch('/api/import/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selectedArticle.content,
          title: selectedArticle.title,
          platform: selectedPlatform.id,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Update the editors with imported content
        if (titleEditor && selectedArticle.title) {
          titleEditor.commands.setContent(selectedArticle.title)
          setClientPost(prev => ({ ...prev, title: selectedArticle.title }))
        }
        if (contentEditor && data.content) {
          contentEditor.commands.setContent(data.content)
          setClientPost(prev => ({ ...prev, content: data.content }))
        }
        // Go back to settings view and reset import state
        setSettingsView('settings')
        setSelectedPlatform(null)
        setImportUsername('')
        setImportArticles([])
        setSelectedArticle(null)
      } else {
        setImportError('Failed to convert article')
      }
    } catch (err) {
      setImportError('Failed to import article')
    } finally {
      setImporting(false)
    }
  }

  // Handle platform selection
  const handleSelectPlatform = (platform) => {
    setSelectedPlatform(platform)
    setImportUsername('')
    setImportArticles([])
    setImportError('')
    setSelectedArticle(null)
    setSettingsView('import-articles')
  }

  const ParagraphDocument = Document.extend({ content: 'paragraph' })

  const titleEditor = useEditor({
    content: post.title,
    extensions: [
      ParagraphDocument,
      Paragraph,
      Text,
      Placeholder.configure({
        placeholder: "Your post's title...",
      }),
    ],
    onUpdate: ({ editor: newEditor }) => {
      setClientPost(prevPost => ({
        ...prevPost,
        title: newEditor.getHTML().slice(3, -4),
      }))
    },
  })

  const excerptEditor = useEditor({
    content: post.excerpt,
    extensions: [
      ParagraphDocument,
      Paragraph,
      Text,
      Placeholder.configure({
        placeholder: 'A short excerpt describing your post...',
      }),
      CharacterCount.configure({
        limit: 500,
      }),
    ],
    onUpdate: ({ editor: newEditor }) => {
      setClientPost(prevPost => ({
        ...prevPost,
        excerpt: newEditor.getHTML().slice(3, -4),
      }))
    },
  })

  const contentEditor = useEditor({
    content: post.content,
    autofocus: 'end',
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'tiptap-link',
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'tiptap-image',
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your post content here...',
      }),
      Underline,
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
      },
    },
    onUpdate: ({ editor: newEditor }) => {
      setClientPost(prevPost => ({ ...prevPost, content: newEditor.getHTML() }))
    },
  })

  function addImage() {
    // Create a file input element
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    
    // Listen for file selection
    input.onchange = async (event) => {
      const file = event.target.files[0]
      if (!file) return
      
      // Show loading indicator
      const loadingEl = document.createElement('div')
      loadingEl.textContent = 'Uploading image...'
      loadingEl.style.padding = '1rem'
      loadingEl.style.background = 'var(--grey-5)'
      loadingEl.style.borderRadius = '0.5rem'
      loadingEl.style.position = 'fixed'
      loadingEl.style.zIndex = '9999'
      loadingEl.style.top = '1rem'
      loadingEl.style.right = '1rem'
      document.body.appendChild(loadingEl)
      
      try {
        // Import the function to avoid module issues
        const { uploadToImgBB } = await import('../../lib/utils')
        
        // Get API key from environment variable
        // This ensures we're not hardcoding sensitive keys in the source code
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API
        
        if (!apiKey) {
          alert('ImgBB API key not configured. Please check your environment variables.')
          return
        }
        
        // Upload image
        const imageUrl = await uploadToImgBB(file, apiKey)
        
        if (imageUrl) {
          // Insert the image into the editor
          contentEditor.chain().focus().setImage({ src: imageUrl }).run()
        } else {
          alert('Failed to upload image. Please try again.')
        }
      } catch (error) {
        console.error('Image upload error:', error)
        alert('Error uploading image. Please try again.')
      } finally {
        // Remove loading indicator
        document.body.removeChild(loadingEl)
      }
    }
    
    // Trigger file selection dialog
    input.click()
  }

  return (
    <>
      <Head>
        <title>
          {clientPost.title
            ? `Editing post: ${clientPost.title} / Bublr`
            : 'Editing...'}
        </title>
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400;1,600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono&display=swap"
          rel="stylesheet"
        />
      </Head>

      <header
        css={css`
          display: flex;
          align-items: center;

          button:first-of-type {
            margin-left: auto;
          }

          button:last-child {
            margin-left: 1rem;
          }
        `}
      >
        <LinkIconButton href="/dashboard">
          <ArrowLeftIcon />
        </LinkIconButton>

        {/* Auto-save status indicator */}
        <span
          css={css`
            margin-left: auto;
            margin-right: 1rem;
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
          {saveStatus === 'saved' && !hasChanges() && (
            <>
              <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
              </svg>
              Saved
            </>
          )}
          {saveStatus === 'unsaved' && hasChanges() && (
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

        <Dialog.Root>
          <Dialog.Trigger as={IconButton}>
            <DotsVerticalIcon />
          </Dialog.Trigger>

          <ModalOverlay />

          <Dialog.Content
            css={css`
              background: var(--grey-1);
              border-radius: 0.5rem;
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              min-width: 320px;
              max-width: 420px;
              overflow: hidden;
              z-index: 100;
              max-height: 85vh;
              display: flex;
              flex-direction: column;
            `}
          >
            {/* Scrollable content wrapper */}
            <div
              css={css`
                flex: 1;
                overflow-y: auto;
                padding: 1.5rem;

                /* Sleek pill scrollbar */
                &::-webkit-scrollbar {
                  width: 6px;
                }
                &::-webkit-scrollbar-track {
                  background: transparent;
                }
                &::-webkit-scrollbar-thumb {
                  background: var(--grey-2);
                  border-radius: 3px;
                  opacity: 0;
                  transition: opacity 0.2s ease, background 0.2s ease;
                }
                &:hover::-webkit-scrollbar-thumb,
                &::-webkit-scrollbar-thumb:active {
                  background: var(--grey-3);
                }

                /* Firefox */
                scrollbar-width: thin;
                scrollbar-color: var(--grey-2) transparent;
              `}
            >
            {/* Settings View */}
            {settingsView === 'settings' && (
            <div>
            <Dialog.Title>Post Settings</Dialog.Title>
            <Dialog.Description
              css={css`
                margin: 1rem 0 0.5rem 0;
                max-width: 20rem;
                color: var(--grey-3);
                font-size: 0.9rem;
              `}
            >
              Make changes to your post&apos;s metadata.
            </Dialog.Description>
            <div
              css={css`
                margin: 1.5rem 0;
              `}
            >
              <label
                htmlFor="post-slug"
                css={css`
                  display: block;
                  margin-bottom: 0.5rem;
                `}
              >
                Slug
              </label>
              <div
                css={css`
                  position: relative;
                `}
              >
                <input
                  type="text"
                  id="post-slug"
                  value={clientPost.slug}
                  onChange={e => {
                    setSlugErr(false)
                    setClientPost(prevPost => ({
                      ...prevPost,
                      slug: e.target.value,
                    }))
                  }}
                  css={css`
                    display: block;
                    width: 100%;
                    padding: 0.75em 1em;
                    padding-right: ${slugValidating ? '5.5rem' : '1em'};
                    background: none;
                    border: 1px solid ${slugErr ? '#e55050' : 'var(--grey-2)'};
                    outline: none;
                    border-radius: 0.5rem;
                    color: var(--grey-4);
                    font-size: inherit;
                    font-family: inherit;
                    transition: border-color 0.2s ease;

                    &::placeholder {
                      color: var(--grey-3);
                    }

                    &:focus {
                      border-color: ${slugErr ? '#e55050' : 'var(--grey-3)'};
                    }
                  `}
                />
                {/* Validation status indicator */}
                {slugValidating && (
                  <span
                    css={css`
                      position: absolute;
                      right: 10px;
                      top: 50%;
                      transform: translateY(-50%);
                      display: flex;
                      align-items: center;
                      gap: 0.4rem;
                      font-size: 0.75rem;
                      color: var(--grey-3);
                    `}
                  >
                    <span
                      css={css`
                        width: 10px;
                        height: 10px;
                        border: 1.5px solid var(--grey-3);
                        border-bottom-color: transparent;
                        border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                        @keyframes spin {
                          to { transform: rotate(360deg); }
                        }
                      `}
                    />
                    Checking...
                  </span>
                )}
              </div>
              {slugErr && (
                <p
                  css={css`
                    margin-top: 0.5rem;
                    font-size: 0.8rem;
                    color: #e55050;
                  `}
                >
                  Invalid slug. Already in use or contains special characters.
                </p>
              )}
              <p
                css={css`
                  margin-top: 0.5rem;
                  font-size: 0.75rem;
                  color: var(--grey-3);
                `}
              >
                Only lowercase letters, numbers, and hyphens allowed.
              </p>
            </div>

            <div
              css={css`
                margin: 1.5rem 0;
              `}
            >
              <label
                css={css`
                  display: block;
                  margin-bottom: 0.5rem;
                `}
              >
                Profile Dot Color
              </label>
              <p
                css={css`
                  font-size: 0.8rem;
                  color: var(--grey-3);
                  margin-bottom: 0.75rem;
                `}
              >
                Choose a color for this post on your profile page
              </p>
              <div
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  flex-wrap: wrap;
                `}
              >
                {DOT_COLORS.map(({ color, name }) => (
                  <button
                    key={color}
                    type="button"
                    title={name}
                    onClick={async () => {
                      await firestore
                        .collection('posts')
                        .doc(post.id)
                        .update({ dotColor: color })
                    }}
                    css={css`
                      width: 28px;
                      height: 28px;
                      border-radius: 50%;
                      background-color: ${color};
                      border: 2px solid ${post.dotColor === color ? 'var(--grey-4)' : 'transparent'};
                      cursor: pointer;
                      transition: all 0.2s ease;

                      &:hover {
                        transform: scale(1.1);
                      }
                    `}
                  />
                ))}
              </div>
            </div>

            {/* Text Direction */}
            <div
              css={css`
                margin: 1.5rem 0;
              `}
            >
              <label
                css={css`
                  display: block;
                  margin-bottom: 0.5rem;
                `}
              >
                Text Direction
              </label>
              <p
                css={css`
                  font-size: 0.8rem;
                  color: var(--grey-3);
                  margin-bottom: 0.75rem;
                `}
              >
                Set text direction for RTL languages (Hebrew, Arabic, etc.)
              </p>
              <div
                css={css`
                  display: flex;
                  gap: 0.5rem;
                `}
              >
                {[
                  { value: 'auto', label: 'Auto' },
                  { value: 'ltr', label: 'LTR' },
                  { value: 'rtl', label: 'RTL' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={async () => {
                      await firestore
                        .collection('posts')
                        .doc(post.id)
                        .update({ textDirection: value })
                    }}
                    css={css`
                      padding: 0.5rem 1rem;
                      border-radius: 0.375rem;
                      font-size: 0.85rem;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      background: ${(post.textDirection || 'auto') === value ? 'var(--grey-4)' : 'transparent'};
                      color: ${(post.textDirection || 'auto') === value ? 'var(--grey-1)' : 'var(--grey-4)'};
                      border: 1px solid ${(post.textDirection || 'auto') === value ? 'var(--grey-4)' : 'var(--grey-2)'};

                      &:hover {
                        border-color: var(--grey-3);
                      }
                    `}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Typography Override */}
            <div
              css={css`
                margin: 1.5rem 0;
              `}
            >
              <label
                css={css`
                  display: block;
                  margin-bottom: 0.5rem;
                `}
              >
                Typography
              </label>
              <p
                css={css`
                  font-size: 0.8rem;
                  color: var(--grey-3);
                  margin-bottom: 0.75rem;
                `}
              >
                Override your blog's default fonts for this post only.
              </p>

              <div css={css`display: grid; gap: 0.75rem;`}>
                <div>
                  <label css={css`font-size: 0.75rem; color: var(--grey-3); display: block; margin-bottom: 0.25rem;`}>
                    Heading Font
                  </label>
                  <FontPicker
                    value={post.fontOverrides?.headingFont || null}
                    onChange={async (font) => {
                      await firestore
                        .collection('posts')
                        .doc(post.id)
                        .update({
                          'fontOverrides.headingFont': font,
                        })
                    }}
                    fontType="heading"
                    allowBlogDefault
                    blogDefaultFont={userdata?.fontSettings?.headingFont || DEFAULT_FONTS.headingFont}
                  />
                </div>

                <div>
                  <label css={css`font-size: 0.75rem; color: var(--grey-3); display: block; margin-bottom: 0.25rem;`}>
                    Body Font
                  </label>
                  <FontPicker
                    value={post.fontOverrides?.bodyFont || null}
                    onChange={async (font) => {
                      await firestore
                        .collection('posts')
                        .doc(post.id)
                        .update({
                          'fontOverrides.bodyFont': font,
                        })
                    }}
                    fontType="body"
                    allowBlogDefault
                    blogDefaultFont={userdata?.fontSettings?.bodyFont || DEFAULT_FONTS.bodyFont}
                  />
                </div>

                <div>
                  <label css={css`font-size: 0.75rem; color: var(--grey-3); display: block; margin-bottom: 0.25rem;`}>
                    Code Font
                  </label>
                  <FontPicker
                    value={post.fontOverrides?.codeFont || null}
                    onChange={async (font) => {
                      await firestore
                        .collection('posts')
                        .doc(post.id)
                        .update({
                          'fontOverrides.codeFont': font,
                        })
                    }}
                    fontType="code"
                    allowBlogDefault
                    blogDefaultFont={userdata?.fontSettings?.codeFont || DEFAULT_FONTS.codeFont}
                  />
                </div>
              </div>
            </div>

            {/* Import Article Button */}
            <Button
              outline
              onClick={() => {
                setSettingsView('import')
                setImportUsername('')
                setImportArticles([])
                setImportError('')
                setSelectedArticle(null)
              }}
              css={css`
                width: 100%;
                margin-bottom: 1rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;

                svg {
                  width: 15px;
                  height: 15px;
                }
              `}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import Article
            </Button>

            <div
              css={css`
                display: flex;
                gap: 1rem;
                width: 100%;

                button {
                  font-size: 0.9rem;
                }
              `}
            >
              <Button
                onClick={async () => {
                  const willPublish = !post.published

                  try {
                    const response = await fetch('/api/posts/publish', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        postId: post.id,
                        publish: willPublish,
                      }),
                    })

                    const result = await response.json()

                    if (result.moderated && !result.published) {
                      // Content was flagged by moderation - show custom popup
                      setSpamPopup({
                        isOpen: true,
                        reason: result.reason,
                        category: result.category,
                      })
                    }
                  } catch (error) {
                    console.error('Publish error:', error)
                    // Fallback to direct update if API fails
                    await firestore
                      .collection('posts')
                      .doc(post.id)
                      .update({ published: willPublish })
                  }
                }}
                css={css`flex: 1;`}
              >
                {post.published ? 'Make Draft' : 'Publish'}
              </Button>
              <Button
                outline
                onClick={async () => {
                  await removePostForUser(post.author, post.id)
                  router.push('/dashboard')
                }}
                css={css`flex: 1;`}
              >
                Delete
              </Button>
            </div>

            {post.published && userdata ? (
              <p
                css={css`
                  margin: 1.5rem 0 0 0;
                  font-size: 0.9rem;
                  max-width: 15rem;
                  word-wrap: break-word;

                  a {
                    text-decoration: none;
                    color: inherit;
                    font-style: italic;
                    border-bottom: 1px dotted var(--grey-3);
                  }
                `}
              >
                See your post live at:{' '}
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`/${userdata.name}/${post.slug}`}
                >
                  bublr.life/{userdata.name}/{post.slug}
                </a>
              </p>
            ) : (
              ''
            )}
            </div>
            )}

            {/* Platform Selection View */}
            {settingsView === 'import' && (
            <div>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  margin-bottom: 1rem;
                `}
              >
                <IconButton
                  onClick={() => {
                    setSettingsView('settings')
                    setSelectedPlatform(null)
                  }}
                  css={css`margin-left: -0.5rem;`}
                >
                  <ArrowLeftIcon />
                </IconButton>
                <Dialog.Title css={css`margin: 0;`}>Import Article</Dialog.Title>
              </div>

              <p
                css={css`
                  color: var(--grey-3);
                  font-size: 0.85rem;
                  margin-bottom: 1.25rem;
                  line-height: 1.5;
                `}
              >
                Choose a platform to import your content from. We&apos;ll fetch your public posts.
              </p>

              {/* Platform grid */}
              <div
                css={css`
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 0.5rem;
                  margin-bottom: 1rem;
                `}
              >
                {IMPORT_PLATFORMS.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => handleSelectPlatform(platform)}
                    css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.6rem;
                      padding: 0.75rem 1rem;
                      border: 1px solid var(--grey-2);
                      border-radius: 0.33em;
                      background: transparent;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      text-align: left;

                      &:hover {
                        border-color: var(--grey-3);
                        background: var(--grey-2);
                      }
                    `}
                  >
                    <span
                      css={css`
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 18px;
                        height: 18px;
                        flex-shrink: 0;
                        color: var(--grey-4);
                      `}
                    >
                      {PlatformIcons[platform.id]}
                    </span>
                    <span
                      css={css`
                        font-size: 0.85rem;
                        color: var(--grey-5);
                        font-weight: 500;
                      `}
                    >
                      {platform.name}
                    </span>
                  </button>
                ))}
              </div>

              <p
                css={css`
                  font-size: 0.7rem;
                  color: var(--grey-3);
                  text-align: center;
                  margin-top: 1rem;
                `}
              >
                GYD (Get Your Data) - Import your content from other platforms
              </p>
            </div>
            )}

            {/* Import Articles View */}
            {settingsView === 'import-articles' && (
            <div>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  margin-bottom: 1rem;
                  padding-right: 2rem;
                `}
              >
                <IconButton
                  onClick={() => {
                    setSettingsView('import')
                    setImportArticles([])
                    setImportError('')
                    setSelectedArticle(null)
                  }}
                  css={css`margin-left: -0.5rem;`}
                >
                  <ArrowLeftIcon />
                </IconButton>
                <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
                  {selectedPlatform && (
                    <span
                      css={css`
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 18px;
                        height: 18px;
                        color: var(--grey-4);
                      `}
                    >
                      {PlatformIcons[selectedPlatform.id]}
                    </span>
                  )}
                  <Dialog.Title css={css`margin: 0;`}>
                    Import from {selectedPlatform?.name || 'Platform'}
                  </Dialog.Title>
                </div>
              </div>

              <p
                css={css`
                  color: var(--grey-3);
                  font-size: 0.85rem;
                  margin-bottom: 1.25rem;
                  line-height: 1.5;
                `}
              >
                {selectedPlatform?.description || 'Enter your username to fetch your posts.'}
              </p>

              {/* Username input */}
              <div
                css={css`
                  display: flex;
                  gap: 8px;
                  margin-bottom: 1rem;
                `}
              >
                <input
                  type="text"
                  value={importUsername}
                  onChange={(e) => setImportUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleFetchArticles()
                    }
                  }}
                  placeholder={selectedPlatform?.placeholder || 'username'}
                  css={css`
                    flex: 1;
                    padding: 0.6rem 1rem;
                    border: 1px solid var(--grey-2);
                    border-radius: 0.33em;
                    background: none;
                    color: var(--grey-4);
                    font-size: 0.9rem;
                    outline: none;
                    transition: border-color 0.2s ease;

                    &:focus {
                      border-color: var(--grey-3);
                    }

                    &::placeholder {
                      color: var(--grey-3);
                    }
                  `}
                />
                <Button
                  onClick={handleFetchArticles}
                  disabled={importLoading}
                  css={css`font-size: 0.85rem;`}
                >
                  {importLoading ? 'Loading...' : 'Fetch'}
                </Button>
              </div>

              {/* Error message */}
              {importError && (
                <div
                  css={css`
                    border: 1px solid var(--grey-2);
                    border-radius: 0.33em;
                    padding: 0.6rem 1rem;
                    margin-bottom: 1rem;
                  `}
                >
                  <p
                    css={css`
                      color: #e55050;
                      font-size: 0.85rem;
                      margin: 0;
                    `}
                  >
                    {importError}
                  </p>
                </div>
              )}

              {/* Articles list */}
              {importArticles.length > 0 && (
                <div css={css`margin-bottom: 1rem;`}>
                  <p
                    css={css`
                      font-size: 0.8rem;
                      color: var(--grey-3);
                      margin-bottom: 0.5rem;
                    `}
                  >
                    Select an article to import:
                  </p>
                  <div
                    css={css`
                      display: flex;
                      flex-direction: column;
                      gap: 0.5rem;
                      max-height: 180px;
                      overflow-y: auto;

                      &::-webkit-scrollbar {
                        width: 4px;
                      }
                      &::-webkit-scrollbar-thumb {
                        background: var(--grey-2);
                        border-radius: 2px;
                      }
                    `}
                  >
                    {importArticles.map((article, index) => (
                      <button
                        key={article.guid || index}
                        onClick={() => setSelectedArticle(article)}
                        css={css`
                          text-align: left;
                          padding: 0.6rem 1rem;
                          border: 1px solid ${selectedArticle === article ? 'var(--grey-4)' : 'var(--grey-2)'};
                          border-radius: 0.33em;
                          background: ${selectedArticle === article ? 'var(--grey-2)' : 'transparent'};
                          cursor: pointer;
                          transition: all 0.2s ease;

                          &:hover {
                            border-color: var(--grey-3);
                          }
                        `}
                      >
                        <p
                          css={css`
                            font-size: 0.85rem;
                            color: var(--grey-5);
                            margin: 0 0 4px 0;
                            font-weight: 500;
                          `}
                        >
                          {article.title}
                        </p>
                        <p
                          css={css`
                            font-size: 0.75rem;
                            color: var(--grey-3);
                            margin: 0;
                          `}
                        >
                          {new Date(article.pubDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Import button */}
              {selectedArticle && (
                <Button
                  onClick={handleImportArticle}
                  disabled={importing}
                  css={css`width: 100%; font-size: 0.9rem;`}
                >
                  {importing ? 'Importing...' : 'Import Selected Article'}
                </Button>
              )}
            </div>
            )}
            </div>
            {/* End scrollable content wrapper */}

            <Dialog.Close
              as={IconButton}
              onClick={() => {
                setSettingsView('settings')
                setSelectedPlatform(null)
                setImportUsername('')
                setImportArticles([])
                setImportError('')
                setSelectedArticle(null)
              }}
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
      </header>

      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-top: 5rem;
          margin-bottom: 2.5rem;
        `}
      >
        <Button
          outline
          css={css`
            font-size: 0.9rem;
          `}
          onClick={() => {
            addImage()
          }}
        >
          + Image
        </Button>

        <VoiceInput
          onTranscript={(text) => {
            if (contentEditor) {
              // Insert the transcribed text at the current cursor position
              // or at the end if no selection
              contentEditor.chain().focus().insertContent(text + ' ').run()
            }
          }}
          disabled={!contentEditor}
        />
      </div>

      <div
        css={css`
          font-size: 1.5rem;
          font-weight: 500;
        `}
      >
        <EditorContent editor={titleEditor} />
      </div>

      <div
        css={css`
          margin: 1.5rem 0;
          font-size: 1.15rem;
          font-weight: 500;
          color: var(--grey-4);
        `}
      >
        <EditorContent editor={excerptEditor} />
      </div>

      <PostContainer
        textDirection={post.textDirection || 'auto'}
        css={css`
          .ProseMirror-focused {
            outline: none;
          }

          margin-bottom: 5rem;
          
          .tiptap-editor-content {
            min-height: 300px;
            transition: all 0.2s ease;
          }
          
          .tiptap-image {
            max-width: 100%;
            height: auto;
            border-radius: 0.25rem;
            display: block;
            margin: 1.5rem 0;
          }
          
          .tiptap-link {
            color: #3182ce;
            text-decoration: none;
            border-bottom: 1px solid rgba(49, 130, 206, 0.3);
            transition: border-bottom 0.2s ease;
          }
          
          .tiptap-link:hover {
            border-bottom: 1px solid rgba(49, 130, 206, 0.8);
          }
          
          pre {
            background-color: #2d2d2d;
            border-radius: 0.5rem;
            color: #fff;
            font-family: 'JetBrains Mono', monospace;
            padding: 0.75rem 1rem;
            overflow-x: auto;
          }
          
          pre code {
            color: inherit;
            padding: 0;
            background: none;
            font-size: 0.9em;
          }
          
          code {
            background-color: rgba(0, 0, 0, 0.05);
            border-radius: 0.25rem;
            color: #24292e;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85em;
            padding: 0.2em 0.4em;
          }
          
          html[data-theme='dark'] code {
            background-color: rgba(255, 255, 255, 0.1);
            color: #e1e1e1;
          }
        `}
      >
        {contentEditor && <SelectionMenu editor={contentEditor} />}
        <EditorContent editor={contentEditor} />
      </PostContainer>

      {/* Spam detection popup */}
      <SpamPopup
        isOpen={spamPopup.isOpen}
        onClose={() => setSpamPopup({ isOpen: false, reason: '', category: '' })}
        reason={spamPopup.reason}
        category={spamPopup.category}
      />

      {/* Medium import popup */}
      <MediumImportPopup
        isOpen={mediumImportOpen}
        onClose={() => setMediumImportOpen(false)}
        onImport={({ title, content }) => {
          // Update the editors with imported content
          if (titleEditor && title) {
            titleEditor.commands.setContent(title)
            setClientPost(prev => ({ ...prev, title }))
          }
          if (contentEditor && content) {
            contentEditor.commands.setContent(content)
            setClientPost(prev => ({ ...prev, content }))
          }
        }}
      />
    </>
  )
}

export default function PostEditor() {
  const router = useRouter()
  const [user, userLoading, userError] = useAuthState(auth)
  const [post, postLoading, postError] = useDocumentData(
    firestore.doc(`posts/${router.query.pid}`),
    {
      idField: 'id',
    },
  )

  useEffect(() => {
    if (!user && !userLoading && !userError) {
      router.push('/')
      return
    } else if (!post && !postLoading && !postError) {
      router.push('/')
      return
    }
  }, [router, user, userLoading, userError, post, postLoading, postError])

  if (userError || postError) {
    return (
      <>
        <p>Oop, we&apos;ve had an error:</p>
        <pre>{JSON.stringify(userError)}</pre>
        <pre>{JSON.stringify(postError)}</pre>
      </>
    )
  } else if (post) {
    return <Editor post={post} />
  }

  return <Spinner />
}

PostEditor.getLayout = function PostEditorLayout(page) {
  return (
    <Container
      maxWidth="640px"
      css={css`
        margin-top: 5rem;
      `}
    >
      {page}
    </Container>
  )
}