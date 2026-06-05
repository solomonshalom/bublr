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
  ExternalLinkIcon,
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

import { LoadingContainer } from '../../components/loading-container'
import { GsapReveal } from '../../components/gsap-reveal'
import PostContainer from '../../components/post-container'
import VoiceInput from '../../components/voice-input'
import { IconButton, LinkIconButton } from '../../components/button'
import FontPicker from '../../components/font-picker'
import SEOAnalyzer from '../../components/seo-analyzer'
import { DEFAULT_FONTS } from '../../lib/fonts'

// Dashboard design system (chord.so-inspired, shared with /dashboard pages)
import DsButton from '../../components/dashboard/ds-button'
import DsSwitch from '../../components/dashboard/ds-switch'
import { DsInput, DsLabel, DsField } from '../../components/dashboard/ds-input'
import { DsTray, DsTile } from '../../components/dashboard/ds-section'

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

        border-radius: 8px;
        border: 1px solid var(--border);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
        background: var(--grey-1);
        color: var(--grey-4);
        padding: 0.35rem;
        gap: 0.15rem;
        transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;

        input {
          background: none;
          border: none;
          margin: 0;
          padding: 0.4rem 0.55rem;
          color: var(--grey-4);
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
          transition: color 0.15s ease, background 0.15s ease;
          border-radius: 4px;
          min-width: 12rem;
        }

        input::placeholder {
          font-family: 'Inter', sans-serif;
          color: var(--grey-3);
          font-size: 0.8rem;
        }

        input:focus {
          outline: none;
          background: var(--accent-soft);
          color: var(--grey-5);
        }

        button {
          background: transparent;
          border: 1px solid transparent;
          width: 1.65rem;
          height: 1.65rem;
          border-radius: 4px;
          color: var(--grey-3);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
          cursor: pointer;
        }

        button:hover {
          background: var(--accent-soft);
          color: var(--accent-foreground);
        }

        button:focus-visible {
          outline: none;
          border-color: var(--accent-border);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }

        button.is-active {
          color: var(--accent-foreground);
          background: var(--accent-soft-strong);
          border-color: var(--accent-border);
        }

        .separator {
          width: 0;
          height: 1.25rem;
          border-left: 1px dashed var(--border-dashed);
          margin: 0 0.25rem;
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
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        backdrop-filter: blur(4px);
      `}
      onClick={onClose}
    >
      <div
        css={css`
          background: var(--grey-1);
          border-radius: 10px;
          padding: 1.5rem;
          max-width: 400px;
          width: 90%;
          border: 1px solid var(--border);
          box-shadow: var(--chord-shadow-md), 0 18px 48px rgba(0, 0, 0, 0.12);
          font-family: 'Inter', sans-serif;
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          css={css`
            font-family: 'Inter', sans-serif;
            font-size: 0.72rem;
            font-weight: 500;
            color: var(--grey-3);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 0.4rem;
          `}
        >
          Post Not Published
        </p>

        <p
          css={css`
            color: var(--grey-4);
            font-size: 0.9rem;
            margin-bottom: 1rem;
            line-height: 1.55;
          `}
        >
          {funnyMessage}
        </p>

        <div
          css={css`
            background: var(--accent-bg);
            border: 1px dashed var(--border-dashed);
            border-radius: 6px;
            padding: 0.7rem 0.9rem;
            margin-bottom: 1.25rem;
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
                font-size: 0.7rem;
                font-weight: 500;
                color: var(--grey-3);
                background: var(--accent-bg-strong);
                border: 1px solid var(--border);
                border-radius: 4px;
                padding: 2px 8px;
                text-transform: uppercase;
                letter-spacing: 0.04em;
              `}
            >
              {category}
            </span>
          )}
        </div>

        <DsButton
          variant="outline"
          onClick={onClose}
          css={css`width: 100%;`}
        >
          Got it, I&apos;ll fix it
        </DsButton>
      </div>
    </div>,
    document.body
  )
}

function SaveStatusPill({ status, hasChanges }) {
  // Only two states: persisted ("Saved") or anything else ("Unsaved").
  // While the save is in flight the change still isn't on disk, so we keep
  // it labelled Unsaved until status flips to 'saved'.
  const isSaved = status === 'saved' && !hasChanges
  const dotColor = isSaved ? 'var(--green)' : '#f59e0b'
  const label = isSaved ? 'Saved' : 'Unsaved'

  return (
    <span
      aria-live="polite"
      css={css`
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.72rem;
        font-weight: 500;
        line-height: 1;
        color: var(--grey-3);
        user-select: none;
      `}
    >
      <span
        aria-hidden="true"
        css={css`
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${dotColor};
          flex-shrink: 0;
        `}
      />
      {label}
    </span>
  )
}

function Editor({ post, onBeforeDelete }) {
  // Right-side post settings sidebar — chord-style focused writing chrome.
  // Closed by default so the writing column is uninterrupted; user toggles
  // with ⌘B or the ⋮ icon in the top bar.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const toggleSettings = useCallback(() => setSettingsOpen(prev => !prev), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

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
      '$mod+KeyB': e => {
        e.preventDefault()
        toggleSettings()
      },
      Escape: () => {
        if (settingsOpen) closeSettings()
      },
    })

    return () => {
      unsubscribe()
    }
  }, [saveChanges, toggleSettings, closeSettings, settingsOpen])

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
        const { uploadToCloudinary } = await import('../../lib/utils')

        // Upload image (signature generated server-side via /api/cloudinary-sign)
        const imageUrl = await uploadToCloudinary(file)
        
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

      {/* Editor top bar — back + title left, save/preview/settings right */}
      <header
        css={css`
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          height: var(--page-header-height);
          padding: 0 0.75rem 0 0.75rem;
          background: var(--muted);
          border-bottom: 1px dashed var(--border-dashed);
          font-family: 'Inter', sans-serif;
        `}
      >
        <div css={css`display: flex; align-items: center; gap: 0.4rem; min-width: 0;`}>
          <LinkIconButton href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeftIcon />
          </LinkIconButton>
          <h2 css={css`
            font-size: 0.825rem;
            font-weight: 500;
            color: var(--grey-5);
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            letter-spacing: -0.005em;
          `}>
            {clientPost.title ? clientPost.title.replace(/<[^>]+>/g, '').trim() || 'Untitled' : 'Untitled'}
          </h2>
        </div>
        <div css={css`display: flex; align-items: center; gap: 0.75rem;`}>
          <SaveStatusPill status={saveStatus} hasChanges={hasChanges()} />
          <IconButton
            onClick={toggleSettings}
            aria-pressed={settingsOpen}
            aria-label="Toggle post settings (⌘B)"
            title="Toggle post settings (⌘B)"
            css={settingsOpen ? css`
              background: var(--accent-soft);
              color: var(--accent-foreground);
              border-color: var(--accent-border);
            ` : null}
          >
            <DotsVerticalIcon />
          </IconButton>
        </div>
      </header>

      {/* Post settings sidebar — chord-style right panel, ⌘B to toggle */}
      <aside
        data-open={settingsOpen ? 'true' : 'false'}
        aria-hidden={!settingsOpen}
        css={css`
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 22rem;
          background: var(--grey-1);
          border-left: 1px dashed var(--border-dashed);
          display: flex;
          flex-direction: column;
          z-index: 40;
          transform: translateX(100%);
          transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
          font-family: 'Inter', sans-serif;

          &[data-open='true'] {
            transform: translateX(0);
            box-shadow: var(--chord-shadow-md), -8px 0 24px rgba(0, 0, 0, 0.06);
          }

          @media (max-width: 720px) {
            width: 100vw;
          }
        `}
      >
        <header
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            height: var(--page-header-height);
            padding: 0 0.5rem 0 1rem;
            background: var(--muted);
            border-bottom: 1px dashed var(--border-dashed);
            flex-shrink: 0;
          `}
        >
          <h3 css={css`
            font-family: 'Inter', sans-serif;
            font-size: 0.65rem;
            font-weight: 500;
            color: var(--grey-3);
            text-transform: uppercase;
            letter-spacing: 0.12em;
            margin: 0;
          `}>
            Post Settings
          </h3>
          <IconButton onClick={closeSettings} aria-label="Close (⌘B)">
            <Cross2Icon />
          </IconButton>
        </header>
        <div
          data-lenis-prevent
          css={css`
            flex: 1;
            overflow-y: auto;
            padding: 1.25rem 1rem 2.5rem 1rem;
            display: flex;
            flex-direction: column;
            gap: 1.25rem;

            &::-webkit-scrollbar { width: 6px; }
            &::-webkit-scrollbar-track { background: transparent; }
            &::-webkit-scrollbar-thumb {
              background: var(--grey-2);
              border-radius: 3px;
            }
            scrollbar-width: thin;
            scrollbar-color: var(--grey-2) transparent;
          `}
        >
            {/* Settings View */}
            {settingsView === 'settings' && (
            <div css={css`display: flex; flex-direction: column; gap: 1.5rem;`}>

            {/* Visibility — chord-style tray with DsSwitch for publish toggle */}
            <section css={css`display: flex; flex-direction: column; gap: 0.5rem;`}>
              <h4 css={css`
                font-family: 'Inter', sans-serif;
                font-size: 0.625rem;
                font-weight: 500;
                color: var(--grey-3);
                text-transform: uppercase;
                letter-spacing: 0.12em;
                margin: 0;
                padding: 0 0.25rem;
              `}>
                Visibility
              </h4>
              <DsTray>
                <DsTile css={css`display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;`}>
                  <div css={css`min-width: 0;`}>
                    <p css={css`font-size: 0.85rem; font-weight: 500; color: var(--grey-5); margin: 0;`}>
                      Published
                    </p>
                    <p css={css`font-size: 0.72rem; color: var(--grey-3); margin: 0.15rem 0 0 0; line-height: 1.4;`}>
                      {post.published
                        ? 'Live and discoverable to readers'
                        : 'Hidden — saved as a private draft'}
                    </p>
                  </div>
                  <DsSwitch
                    checked={!!post.published}
                    onChange={async () => {
                      const willPublish = !post.published
                      try {
                        const response = await fetch('/api/posts/publish', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ postId: post.id, publish: willPublish }),
                        })
                        const result = await response.json()
                        if (result.moderated && !result.published) {
                          setSpamPopup({
                            isOpen: true,
                            reason: result.reason,
                            category: result.category,
                          })
                        }
                      } catch (error) {
                        console.error('Publish error:', error)
                        await firestore.collection('posts').doc(post.id).update({ published: willPublish })
                      }
                    }}
                  />
                </DsTile>
                {/* Preview tile — same shape as Published, links to /dashboard/[pid]/preview */}
                <DsTile
                  as="a"
                  href={`/dashboard/${post.id}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  hoverable
                  css={css`
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    text-decoration: none;
                    color: inherit;
                  `}
                >
                  <div css={css`min-width: 0;`}>
                    <p css={css`font-size: 0.85rem; font-weight: 500; color: var(--grey-5); margin: 0;`}>
                      Preview
                    </p>
                    <p css={css`font-size: 0.72rem; color: var(--grey-3); margin: 0.15rem 0 0 0; line-height: 1.4;`}>
                      See your post as readers will
                    </p>
                  </div>
                  <span
                    css={css`
                      flex-shrink: 0;
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      width: 1.75rem;
                      height: 1rem;
                      color: var(--grey-3);
                    `}
                  >
                    <ExternalLinkIcon width={14} height={14} />
                  </span>
                </DsTile>
                {post.published && userdata && (
                  <DsTile>
                    <p css={css`
                      font-family: 'Inter', sans-serif;
                      font-size: 0.625rem;
                      font-weight: 500;
                      color: var(--grey-3);
                      text-transform: uppercase;
                      letter-spacing: 0.1em;
                      margin: 0 0 0.35rem 0;
                    `}>
                      Live URL
                    </p>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`/${userdata.name}/${post.slug}`}
                      css={css`
                        display: block;
                        font-size: 0.8rem;
                        color: var(--grey-4);
                        text-decoration: none;
                        word-break: break-all;
                        border-bottom: 1px dotted var(--grey-3);
                        padding-bottom: 1px;
                        width: fit-content;
                        max-width: 100%;

                        &:hover {
                          color: var(--accent-foreground);
                          border-bottom-color: var(--accent-border);
                        }
                      `}
                    >
                      bublr.life/{userdata.name}/{post.slug}
                    </a>
                  </DsTile>
                )}
              </DsTray>
            </section>

            {/* SEO Analyzer — collapsible insight into search-engine readiness */}
            <section css={css`display: flex; flex-direction: column; gap: 0.5rem;`}>
              <h4 css={css`
                font-family: 'Inter', sans-serif;
                font-size: 0.625rem;
                font-weight: 500;
                color: var(--grey-3);
                text-transform: uppercase;
                letter-spacing: 0.12em;
                margin: 0;
                padding: 0 0.25rem;
              `}>
                SEO
              </h4>
              <SEOAnalyzer
                title={clientPost.title}
                content={clientPost.content}
                excerpt={clientPost.excerpt}
              />
            </section>

            {/* Metadata — slug, dot color, text direction */}
            <section css={css`display: flex; flex-direction: column; gap: 1rem;`}>
              <h4 css={css`
                font-family: 'Inter', sans-serif;
                font-size: 0.625rem;
                font-weight: 500;
                color: var(--grey-3);
                text-transform: uppercase;
                letter-spacing: 0.12em;
                margin: 0;
                padding: 0 0.25rem;
              `}>
                Metadata
              </h4>

            <DsField css={css`margin: 0;`}>
              <DsLabel htmlFor="post-slug">Slug</DsLabel>
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
                    padding: 0.55rem 0.75rem;
                    padding-right: ${slugValidating ? '5.5rem' : '0.75rem'};
                    background: var(--grey-1);
                    border: 1px solid ${slugErr ? '#e55050' : 'var(--border)'};
                    outline: none;
                    border-radius: 6px;
                    color: var(--grey-4);
                    font-family: 'Inter', sans-serif;
                    font-size: 0.875rem;
                    line-height: 1.4;
                    transition: border-color 150ms ease, box-shadow 150ms ease;

                    &::placeholder {
                      color: var(--grey-3);
                    }

                    &:hover:not(:focus) {
                      border-color: ${slugErr ? '#e55050' : 'var(--grey-3)'};
                    }

                    &:focus {
                      border-color: ${slugErr ? '#e55050' : 'var(--accent-border)'};
                      box-shadow: 0 0 0 3px ${slugErr ? 'rgba(229,80,80,0.15)' : 'var(--accent-soft)'};
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
            </DsField>

            <DsField css={css`margin: 0;`}>
              <DsLabel>Profile Dot Color</DsLabel>
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
                      border: 2px solid ${post.dotColor === color ? 'var(--accent)' : 'transparent'};
                      outline: 2px solid ${post.dotColor === color ? 'transparent' : 'transparent'};
                      outline-offset: 1px;
                      cursor: pointer;
                      transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
                      box-shadow: ${post.dotColor === color ? '0 0 0 3px var(--accent-soft)' : 'none'};

                      &:hover {
                        transform: scale(1.08);
                      }
                    `}
                  />
                ))}
              </div>
            </DsField>

            {/* Text Direction */}
            <DsField css={css`margin: 0;`}>
              <DsLabel>Text Direction</DsLabel>
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
                  gap: 0.4rem;
                `}
              >
                {[
                  { value: 'auto', label: 'Auto' },
                  { value: 'ltr', label: 'LTR' },
                  { value: 'rtl', label: 'RTL' },
                ].map(({ value, label }) => {
                  const isActive = (post.textDirection || 'auto') === value
                  return (
                    <DsButton
                      key={value}
                      size="sm"
                      variant={isActive ? 'default' : 'outline'}
                      onClick={async () => {
                        await firestore
                          .collection('posts')
                          .doc(post.id)
                          .update({ textDirection: value })
                      }}
                      css={css`flex: 1;`}
                    >
                      {label}
                    </DsButton>
                  )
                })}
              </div>
            </DsField>
            </section>

            {/* Typography — chord-style section with mono uppercase header */}
            <section css={css`display: flex; flex-direction: column; gap: 0.5rem;`}>
              <h4 css={css`
                font-family: 'Inter', sans-serif;
                font-size: 0.625rem;
                font-weight: 500;
                color: var(--grey-3);
                text-transform: uppercase;
                letter-spacing: 0.12em;
                margin: 0;
                padding: 0 0.25rem;
              `}>
                Typography
              </h4>
              <p
                css={css`
                  font-size: 0.72rem;
                  color: var(--grey-3);
                  margin: 0 0 0.25rem 0;
                  padding: 0 0.25rem;
                  line-height: 1.4;
                `}
              >
                Override your blog&apos;s default fonts for this post only.
              </p>

              <div css={css`display: grid; gap: 0.75rem;`}>
                <div>
                  <label css={css`font-size: 0.72rem; font-weight: 500; color: var(--grey-3); text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 0.3rem;`}>
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
                  <label css={css`font-size: 0.72rem; font-weight: 500; color: var(--grey-3); text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 0.3rem;`}>
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
                  <label css={css`font-size: 0.72rem; font-weight: 500; color: var(--grey-3); text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 0.3rem;`}>
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
            </section>

            {/* Tools — Import Article action */}
            <section css={css`display: flex; flex-direction: column; gap: 0.5rem;`}>
              <h4 css={css`
                font-family: 'Inter', sans-serif;
                font-size: 0.625rem;
                font-weight: 500;
                color: var(--grey-3);
                text-transform: uppercase;
                letter-spacing: 0.12em;
                margin: 0;
                padding: 0 0.25rem;
              `}>
                Tools
              </h4>
              <DsButton
                variant="outline"
                onClick={() => {
                  setSettingsView('import')
                  setImportUsername('')
                  setImportArticles([])
                  setImportError('')
                  setSelectedArticle(null)
                }}
                css={css`
                  width: 100%;

                  svg {
                    width: 14px;
                    height: 14px;
                  }
                `}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import Article
              </DsButton>
            </section>

            {/* Danger Zone — destructive actions live alone at the bottom */}
            <section css={css`display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;`}>
              <h4 css={css`
                font-family: 'Inter', sans-serif;
                font-size: 0.625rem;
                font-weight: 500;
                color: #e5484d;
                text-transform: uppercase;
                letter-spacing: 0.12em;
                margin: 0;
                padding: 0 0.25rem;
              `}>
                Danger Zone
              </h4>
              <DsButton
                variant="destructive"
                onClick={async () => {
                  onBeforeDelete?.()
                  await removePostForUser(post.author, post.id)
                  router.push('/dashboard')
                }}
                css={css`width: 100%;`}
              >
                Delete Post
              </DsButton>
            </section>
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
                <h3
                  css={css`
                    margin: 0;
                    font-family: 'Inter', sans-serif;
                    font-size: 0.72rem;
                    font-weight: 500;
                    color: var(--grey-3);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                  `}
                >
                  Import Article
                </h3>
              </div>

              <p
                css={css`
                  color: var(--grey-4);
                  font-size: 0.85rem;
                  margin-bottom: 1.25rem;
                  line-height: 1.5;
                `}
              >
                Choose a platform to import your content from. We&apos;ll fetch your public posts.
              </p>

              {/* Platform grid — chord-style tray of selectable tiles */}
              <DsTray
                css={css`
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  margin-bottom: 1rem;
                `}
              >
                {IMPORT_PLATFORMS.map((platform) => (
                  <DsTile
                    key={platform.id}
                    as="button"
                    hoverable
                    onClick={() => handleSelectPlatform(platform)}
                    css={css`
                      display: flex;
                      align-items: center;
                      gap: 0.6rem;
                      padding: 0.55rem 0.7rem;
                      text-align: left;
                      font-family: 'Inter', sans-serif;
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
                  </DsTile>
                ))}
              </DsTray>

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
                  <h3
                    css={css`
                      margin: 0;
                      font-family: 'Inter', sans-serif;
                      font-size: 0.72rem;
                      font-weight: 500;
                      color: var(--grey-3);
                      text-transform: uppercase;
                      letter-spacing: 0.08em;
                    `}
                  >
                    Import from {selectedPlatform?.name || 'Platform'}
                  </h3>
                </div>
              </div>

              <p
                css={css`
                  color: var(--grey-4);
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
                  gap: 0.5rem;
                  margin-bottom: 1rem;
                `}
              >
                <DsInput
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
                  css={css`flex: 1;`}
                />
                <DsButton
                  variant="default"
                  onClick={handleFetchArticles}
                  disabled={importLoading}
                >
                  {importLoading ? 'Loading...' : 'Fetch'}
                </DsButton>
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
                  <DsTray
                    css={css`
                      max-height: 220px;
                      overflow-y: auto;
                    `}
                  >
                    {importArticles.map((article, index) => {
                      const isSelected = selectedArticle === article
                      return (
                        <DsTile
                          key={article.guid || index}
                          as="button"
                          hoverable
                          onClick={() => setSelectedArticle(article)}
                          css={css`
                            text-align: left;
                            padding: 0.55rem 0.7rem;
                            ${isSelected && `
                              border-color: var(--accent-border);
                              background: var(--accent-soft);
                              box-shadow: 0 0 0 3px var(--accent-soft);
                            `}
                          `}
                        >
                          <p
                            css={css`
                              font-size: 0.85rem;
                              color: var(--grey-5);
                              margin: 0 0 0.2rem 0;
                              font-weight: 500;
                            `}
                          >
                            {article.title}
                          </p>
                          <p
                            css={css`
                              font-size: 0.72rem;
                              color: var(--grey-3);
                              margin: 0;
                              text-transform: uppercase;
                              letter-spacing: 0.04em;
                            `}
                          >
                            {new Date(article.pubDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </DsTile>
                      )
                    })}
                  </DsTray>
                </div>
              )}

              {/* Import button */}
              {selectedArticle && (
                <DsButton
                  variant="default"
                  onClick={handleImportArticle}
                  disabled={importing}
                  css={css`width: 100%;`}
                >
                  {importing ? 'Importing...' : 'Import Selected Article'}
                </DsButton>
              )}
            </div>
            )}
        </div>
      </aside>

      {/* Tap-to-close backdrop, only when sidebar is open */}
      {settingsOpen && (
        <div
          onClick={closeSettings}
          aria-hidden="true"
          css={css`
            position: fixed;
            inset: 0;
            background: transparent;
            z-index: 35;

            @media (max-width: 720px) {
              background: rgba(0, 0, 0, 0.32);
            }
          `}
        />
      )}

      <div
        data-settings-open={settingsOpen ? 'true' : 'false'}
        css={css`
          max-width: 720px;
          margin: 0 auto;
          padding: 2rem 1.5rem 5rem 1.5rem;
          transition: margin 240ms cubic-bezier(0.32, 0.72, 0, 1);

          @media (max-width: 720px) {
            padding: 1.25rem 1rem 3rem 1rem;
          }

          /* When sidebar opens on wide enough screens, slide writing column
             left so the sidebar doesn't crop it. Below ~1024px the sidebar
             overlays instead (handled by its own fixed position). */
          @media (min-width: 1080px) {
            &[data-settings-open='true'] {
              margin-right: 22rem;
            }
          }
        `}
      >
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
          margin-bottom: 2.25rem;
        `}
      >
        <DsButton
          variant="outline"
          onClick={() => {
            addImage()
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Image
        </DsButton>

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
          font-family: 'Inter', sans-serif;
          font-size: 1.85rem;
          font-weight: 500;
          line-height: 1.2;
          color: var(--grey-5);
          letter-spacing: -0.015em;

          .ProseMirror {
            outline: none;
          }

          .ProseMirror p.is-editor-empty:first-of-type::before {
            color: var(--grey-3);
            opacity: 0.8;
          }
        `}
      >
        <EditorContent editor={titleEditor} />
      </div>

      <div
        css={css`
          margin: 1rem 0 1.5rem 0;
          padding-bottom: 1.25rem;
          border-bottom: 1px dashed var(--border-dashed);
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          font-weight: 400;
          line-height: 1.5;
          color: var(--grey-3);

          .ProseMirror {
            outline: none;
          }

          .ProseMirror p.is-editor-empty:first-of-type::before {
            color: var(--grey-3);
            opacity: 0.7;
          }
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
            color: var(--accent-foreground);
            text-decoration: none;
            border-bottom: 1px solid var(--accent-border);
            transition: border-color 150ms ease, background 150ms ease;
            padding-bottom: 0.05em;
          }

          .tiptap-link:hover {
            border-bottom-color: var(--accent-foreground);
            background: var(--accent-soft);
          }

          pre {
            background: var(--muted);
            border: 1px dashed var(--border-dashed);
            border-radius: 6px;
            color: var(--grey-4);
            font-family: 'JetBrains Mono', monospace;
            padding: 0.85rem 1rem;
            overflow-x: auto;
            margin: 1.25rem 0;
          }

          pre code {
            color: inherit;
            padding: 0;
            background: none;
            border: none;
            font-size: 0.85em;
          }

          code {
            background: var(--accent-soft);
            border: 1px solid var(--accent-border);
            border-radius: 4px;
            color: var(--accent-foreground);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85em;
            padding: 0.1em 0.35em;
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
            background: var(--green);
            border-color: var(--green);
          }

          ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after {
            content: '';
            width: 5px;
            height: 9px;
            border: 2px solid #ffffff;
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
            background: rgba(245, 158, 11, 0.2);
            border-radius: 3px;
            padding: 0.05em 0.25em;
            color: inherit;
          }

          [data-theme='dark'] mark,
          [data-theme='dark'] .tiptap-highlight {
            background: rgba(251, 191, 36, 0.22);
            color: inherit;
          }

          /* Horizontal Rule Styles */
          hr,
          .tiptap-hr {
            border: none;
            border-top: 1px dashed var(--border-dashed);
            margin: 2.25rem 0;
            cursor: pointer;
            transition: border-color 0.2s ease;
          }

          hr.ProseMirror-selectednode,
          .tiptap-hr.ProseMirror-selectednode {
            border-top-color: var(--accent-border);
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
      </div>{/* end editor body column */}

      {/* Spam detection popup */}
      <SpamPopup
        isOpen={spamPopup.isOpen}
        onClose={() => setSpamPopup({ isOpen: false, reason: '', category: '' })}
        reason={spamPopup.reason}
        category={spamPopup.category}
      />
    </>
  )
}

export default function PostEditor() {
  const router = useRouter()
  const [user, userLoading, userError] = useAuthState(auth)
  const [isDeletingPost, setIsDeletingPost] = useState(false)
  const [post, postLoading, postError] = useDocumentData(
    firestore.doc(`posts/${router.query.pid}`),
    {
      idField: 'id',
    },
  )

  useEffect(() => {
    // Skip redirect if we're in the process of deleting (navigating to /dashboard)
    if (isDeletingPost) return

    if (!user && !userLoading && !userError) {
      router.push('/')
      return
    } else if (!post && !postLoading && !postError) {
      router.push('/')
      return
    }
  }, [router, user, userLoading, userError, post, postLoading, postError, isDeletingPost])

  if (userError || postError) {
    return (
      <>
        <p>Oop, we&apos;ve had an error:</p>
        <pre>{JSON.stringify(userError)}</pre>
        <pre>{JSON.stringify(postError)}</pre>
      </>
    )
  } else if (post) {
    // Post just finished loading — reveal the editor with a slow, premium fade
    // (longer + gentler than page navigation) so it eases in instead of popping.
    return (
      <GsapReveal duration={0.8} ease="power2.out">
        <Editor post={post} onBeforeDelete={() => setIsDeletingPost(true)} />
      </GsapReveal>
    )
  }

  return (
    <LoadingContainer isLoading={true}>
      <div css={css`min-height: 400px;`} />
    </LoadingContainer>
  )
}

PostEditor.getLayout = function PostEditorLayout(page) {
  // Editor owns its own layout — focused writing chrome (top bar + writing
  // column + right settings sidebar toggled by ⌘B), no left dashboard sidebar.
  return page
}