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
  QuoteIcon,
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

// New Notion-like extensions
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import HorizontalRule from '@tiptap/extension-horizontal-rule'

// Custom editor components
import SlashCommands from '../../components/editor/slash-commands'
import EditorFloatingMenu from '../../components/editor/editor-floating-menu'
import Callout from '../../components/editor/callout-extension'

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

// Platform icons for import feature (Simple Icons)
const PlatformIcons = {
  medium: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.21 0A4.201 4.201 0 0 0 0 4.21v15.58A4.201 4.201 0 0 0 4.21 24h15.58A4.201 4.201 0 0 0 24 19.79v-1.093c-.137.013-.278.02-.422.02-2.577 0-4.027-2.146-4.09-4.832a7.592 7.592 0 0 1 .022-.708c.093-1.186.475-2.241 1.105-3.022a3.885 3.885 0 0 1 1.395-1.1c.468-.237 1.127-.367 1.664-.367h.023c.101 0 .202.004.303.01V4.211A4.201 4.201 0 0 0 19.79 0Zm.198 5.583h4.165l3.588 8.435 3.59-8.435h3.864v.146l-.019.004c-.705.16-1.063.397-1.063 1.254h-.003l.003 10.274c.06.676.424.885 1.063 1.03l.02.004v.145h-4.923v-.145l.019-.005c.639-.144.994-.353 1.054-1.03V7.267l-4.745 11.15h-.261L6.15 7.569v9.445c0 .857.358 1.094 1.063 1.253l.02.004v.147H4.405v-.147l.019-.004c.705-.16 1.065-.397 1.065-1.253V6.987c0-.857-.358-1.094-1.064-1.254l-.018-.004zm19.25 3.668c-1.086.023-1.733 1.323-1.813 3.124H24V9.298a1.378 1.378 0 0 0-.342-.047Zm-1.862 3.632c-.1 1.756.86 3.239 2.204 3.634v-3.634z"/>
    </svg>
  ),
  substack: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
    </svg>
  ),
  blogger: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.976 24H2.026C.9 24 0 23.1 0 21.976V2.026C0 .9.9 0 2.025 0H22.05C23.1 0 24 .9 24 2.025v19.95C24 23.1 23.1 24 21.976 24zM12 3.975H9c-2.775 0-5.025 2.25-5.025 5.025v6c0 2.774 2.25 5.024 5.025 5.024h6c2.774 0 5.024-2.25 5.024-5.024v-3.975c0-.6-.45-1.05-1.05-1.05H18c-.524 0-.976-.45-.976-.976 0-2.776-2.25-5.026-5.024-5.026zm3.074 12H9c-.525 0-.975-.45-.975-.975s.45-.976.975-.976h6.074c.526 0 .977.45.977.976s-.45.976-.975.976zm-2.55-7.95c.527 0 .976.45.976.975s-.45.975-.975.975h-3.6c-.525 0-.976-.45-.976-.975s.45-.975.975-.975h3.6z"/>
    </svg>
  ),
  hashnode: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.351 8.019l-6.37-6.37a5.63 5.63 0 0 0-7.962 0l-6.37 6.37a5.63 5.63 0 0 0 0 7.962l6.37 6.37a5.63 5.63 0 0 0 7.962 0l6.37-6.37a5.63 5.63 0 0 0 0-7.962zM12 15.953a3.953 3.953 0 1 1 0-7.906 3.953 3.953 0 0 1 0 7.906z"/>
    </svg>
  ),
  wordpress: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/>
    </svg>
  ),
  ghost: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.256 2.313c2.47.005 5.116 2.008 5.898 2.962l.244.3c1.64 1.994 3.569 4.34 3.569 6.966 0 3.719-2.98 5.808-6.158 7.508-1.433.766-2.98 1.508-4.748 1.508-4.543 0-8.366-3.569-8.366-8.112 0-.706.17-1.425.342-2.15.122-.515.244-1.033.307-1.549.548-4.539 2.967-6.795 8.422-7.408a4.29 4.29 0 01.49-.026Z"/>
    </svg>
  ),
  devto: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.83-.26.24-.24.26-.36.26-2.2 0-1.91-.02-1.96-.29-2.18zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-.72.04-.75.03v1.77l1.22.03 1.2.04v1.28h-1.6c-1.53 0-1.6-.01-1.87-.3l-.3-.28v-3.16c0-3.02.01-3.18.25-3.48.23-.31.25-.31 1.88-.31h1.64v1.3zm4.68 5.45c-.17.43-.64.79-1 .79-.18 0-.45-.15-.67-.39-.32-.32-.45-.63-.82-2.08l-.9-3.39-.45-1.67h.76c.4 0 .75.02.75.05 0 .06 1.16 4.54 1.26 4.83.04.15.32-.7.73-2.3l.66-2.52.74-.04c.4-.02.73 0 .73.04 0 .14-1.67 6.38-1.8 6.68z"/>
    </svg>
  ),
}

import Input from '../../components/input'
import Container from '../../components/container'
import { LoadingContainer } from '../../components/loading-container'
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
        // Don't show if editor doesn't have focus (e.g., popup editor is focused)
        if (!editor.isFocused) return false

        // Check if there's actual text selected (not just a node selection)
        const { selection } = state
        const isTextSelection = selection && !selection.empty && selection.from !== selection.to

        // Get the actual text content of selection
        const selectedText = state.doc.textBetween(selection.from, selection.to, ' ')
        const hasSelectedText = selectedText && selectedText.trim().length > 0

        // Show if editing a link OR if there's actual text selected
        return editor.isActive('link') || (isTextSelection && hasSelectedText)
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
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={editor.isActive('highlight') ? 'is-active' : ''}
            title="Highlight"
            css={css`
              svg {
                fill: currentColor;
              }
            `}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
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
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'is-active' : ''}
            title="Numbered List"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="10" y1="6" x2="21" y2="6"></line>
              <line x1="10" y1="12" x2="21" y2="12"></line>
              <line x1="10" y1="18" x2="21" y2="18"></line>
              <path d="M4 6h1v4"></path>
              <path d="M4 10h2"></path>
              <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
            </svg>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive('blockquote') ? 'is-active' : ''}
            title="Quote"
          >
            <QuoteIcon />
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
        horizontalRule: false, // Use our custom one
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
        placeholder: ({ node, editor }) => {
          // Only show placeholder on empty paragraphs at the top level of the document
          // and only if it's the first node or if the document is effectively empty
          if (node.type.name !== 'paragraph') return ''

          const { doc } = editor.state
          const isFirstNode = doc.firstChild === node
          const docIsEmpty = doc.childCount === 1 && doc.firstChild?.textContent === ''

          if (isFirstNode || docIsEmpty) {
            return "Press '/' for commands, or just start writing..."
          }
          return ''
        },
        showOnlyWhenEditable: true,
        includeChildren: false,
      }),
      Underline,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      // New Notion-like extensions
      TaskList.configure({
        HTMLAttributes: {
          class: 'tiptap-task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'tiptap-task-item',
        },
      }),
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: 'tiptap-highlight',
        },
      }),
      Typography,
      HorizontalRule.configure({
        HTMLAttributes: {
          class: 'tiptap-hr',
        },
      }),
      SlashCommands,
      Callout,
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

          /* Task List Styles */
          ul[data-type="taskList"] {
            list-style: none;
            padding: 0;
            margin: 1rem 0;
          }

          ul[data-type="taskList"] li {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            margin: 0.5rem 0;
          }

          ul[data-type="taskList"] li > label {
            flex-shrink: 0;
            user-select: none;
            margin-top: 0.25rem;
          }

          ul[data-type="taskList"] li > label input[type="checkbox"] {
            appearance: none;
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border: 2px solid var(--grey-3);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
          }

          ul[data-type="taskList"] li > label input[type="checkbox"]:hover {
            border-color: var(--grey-4);
          }

          ul[data-type="taskList"] li > label input[type="checkbox"]:checked {
            background: var(--grey-5);
            border-color: var(--grey-5);
          }

          ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after {
            content: '';
            width: 5px;
            height: 9px;
            border: 2px solid var(--grey-1);
            border-top: none;
            border-left: none;
            transform: rotate(45deg);
            margin-bottom: 2px;
          }

          ul[data-type="taskList"] li[data-checked="true"] > div {
            text-decoration: line-through;
            color: var(--grey-3);
          }

          ul[data-type="taskList"] li > div {
            flex: 1;
          }

          /* Nested task lists */
          ul[data-type="taskList"] ul[data-type="taskList"] {
            margin-left: 1.5rem;
            margin-top: 0.25rem;
            margin-bottom: 0.25rem;
          }

          /* Highlight Styles */
          mark,
          .tiptap-highlight {
            background-color: #fef08a;
            border-radius: 2px;
            padding: 0.1em 0.2em;
          }

          html[data-theme='dark'] mark,
          html[data-theme='dark'] .tiptap-highlight {
            background-color: #854d0e;
            color: #fef9c3;
          }

          /* Horizontal Rule Styles */
          hr,
          .tiptap-hr {
            border: none;
            border-top: 2px solid var(--grey-2);
            margin: 2rem 0;
            cursor: pointer;
            transition: border-color 0.2s ease;
          }

          hr.ProseMirror-selectednode,
          .tiptap-hr.ProseMirror-selectednode {
            border-top-color: var(--grey-4);
          }

          /* Callout/Pop-up Styles */
          .tiptap-callout {
            margin: 1rem 0;
          }
        `}
      >
        {contentEditor && <SelectionMenu editor={contentEditor} />}
        {contentEditor && <EditorFloatingMenu editor={contentEditor} />}
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

  return (
    <LoadingContainer isLoading={true}>
      <div css={css`min-height: 400px;`} />
    </LoadingContainer>
  )
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