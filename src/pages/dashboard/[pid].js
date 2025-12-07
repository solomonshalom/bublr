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
  CheckIcon,
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

import Input from '../../components/input'
import Spinner from '../../components/spinner'
import Container from '../../components/container'
import ModalOverlay from '../../components/modal-overlay'
import PostContainer from '../../components/post-container'
import VoiceInput from '../../components/voice-input'
import Button, { IconButton, LinkIconButton } from '../../components/button'

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
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved', 'saving', 'unsaved'
  const [spamPopup, setSpamPopup] = useState({ isOpen: false, reason: '', category: '' })
  const [mediumImportOpen, setMediumImportOpen] = useState(false)
  const [settingsView, setSettingsView] = useState('settings') // 'settings' or 'import'
  const [importUsername, setImportUsername] = useState('')
  const [importArticles, setImportArticles] = useState([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [importing, setImporting] = useState(false)
  const saveTimeoutRef = useRef(null)
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

  // Auto-save effect
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Don't auto-save if there are no changes
    if (!hasChanges()) return

    // Don't auto-save slug changes (requires validation)
    if (post.slug !== clientPost.slug) {
      setSaveStatus('unsaved')
      return
    }

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
  }, [clientPost, post.slug, hasChanges, saveChanges])

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

  // Handle fetching articles from Medium
  const handleFetchArticles = async () => {
    if (!importUsername.trim()) {
      setImportError('Please enter a Medium username')
      return
    }

    setImportLoading(true)
    setImportError('')
    setImportArticles([])

    try {
      const response = await fetch('/api/medium/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: importUsername.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setImportError(data.error || 'Failed to fetch articles')
        return
      }

      if (data.articles.length === 0) {
        setImportError('No articles found for this user')
        return
      }

      setImportArticles(data.articles)
    } catch (err) {
      setImportError('Failed to connect to Medium')
    } finally {
      setImportLoading(false)
    }
  }

  // Handle importing selected article
  const handleImportArticle = async () => {
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
        // Update the editors with imported content
        if (titleEditor && selectedArticle.title) {
          titleEditor.commands.setContent(selectedArticle.title)
          setClientPost(prev => ({ ...prev, title: selectedArticle.title }))
        }
        if (contentEditor && data.content) {
          contentEditor.commands.setContent(data.content)
          setClientPost(prev => ({ ...prev, content: data.content }))
        }
        // Go back to settings view
        setSettingsView('settings')
      } else {
        setImportError('Failed to convert article')
      }
    } catch (err) {
      setImportError('Failed to import article')
    } finally {
      setImporting(false)
    }
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
              padding: 1.5rem;
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              min-width: 320px;
              max-width: 420px;
              overflow: hidden;
            `}
          >
            {/* Settings View */}
            <div
              css={css`
                transition: all 0.3s ease;
                ${settingsView === 'import' ? 'display: none;' : ''}
              `}
            >
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
              <form>
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
                    display: flex;
                    align-items: center;
                  `}
                >
                  <div>
                    <Input
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
                    />
                    {slugErr && (
                      <p
                        css={css`
                          margin-top: 1rem;
                          font-size: 0.9rem;
                        `}
                      >
                        Invalid slug. That slug is already in use or contains
                        special characters.
                      </p>
                    )}
                  </div>
                  <IconButton
                    type="submit"
                    disabled={clientPost.slug === post.slug || !clientPost.slug}
                    onClick={async e => {
                      e.preventDefault()

                      let slugClashing = await postWithUserIDAndSlugExists(
                        post.author,
                        clientPost.slug,
                      )

                      if (
                        slugClashing ||
                        !clientPost.slug.match(/^[a-z0-9-]+$/i)
                      ) {
                        setSlugErr(true)
                        return
                      }

                      let postCopy = { ...post }
                      delete postCopy.id
                      postCopy.slug = clientPost.slug
                      await firestore
                        .collection('posts')
                        .doc(post.id)
                        .update(postCopy)
                      setSlugErr(false)
                    }}
                  >
                    <CheckIcon />
                  </IconButton>
                </div>
              </form>
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

            {/* Import View */}
            <div
              css={css`
                transition: all 0.3s ease;
                ${settingsView === 'settings' ? 'display: none;' : ''}
              `}
            >
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  margin-bottom: 1rem;
                `}
              >
                <IconButton
                  onClick={() => setSettingsView('settings')}
                  css={css`margin-left: -0.5rem;`}
                >
                  <ArrowLeftIcon />
                </IconButton>
                <Dialog.Title css={css`margin: 0;`}>Import from Medium</Dialog.Title>
              </div>

              <p
                css={css`
                  color: var(--grey-3);
                  font-size: 0.85rem;
                  margin-bottom: 1.25rem;
                  line-height: 1.5;
                `}
              >
                Bring your Medium articles to Bublr. Enter your Medium username to fetch your latest posts.
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
                  placeholder="@username"
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

            <Dialog.Close
              as={IconButton}
              onClick={() => setSettingsView('settings')}
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