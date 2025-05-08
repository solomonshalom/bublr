/** @jsxImportSource @emotion/react */
import Head from 'next/head'
import tinykeys from 'tinykeys'
import { css } from '@emotion/react'
import { useEffect, useState } from 'react'
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
  ListBulletIcon,
  HeadingIcon,
  QuoteIcon,
} from '@radix-ui/react-icons'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'

import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Text from '@tiptap/extension-text'
import Document from '@tiptap/extension-document'

import * as Dialog from '@radix-ui/react-dialog'

import firebase, { auth, firestore } from '../../lib/firebase'
import { postWithUserIDAndSlugExists, removePostForUser } from '../../lib/db'

import Input from '../../components/input'
import Spinner from '../../components/spinner'
import Container from '../../components/container'
import ModalOverlay from '../../components/modal-overlay'
import PostContainer from '../../components/post-container'
import Button, { IconButton, LinkIconButton } from '../../components/button'

function SelectionMenu({ editor }) {
  const [editingLink, setEditingLink] = useState(false)
  const [url, setUrl] = useState('')

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100 }}
      shouldShow={({ editor, view, state, oldState, from, to }) => {
        // Only show bubble menu for non-empty text selection
        return from !== to && !editor.isActive('image')
      }}
      css={css`
        display: flex;
        align-items: center;

        border-radius: 0.5rem;
        box-shadow: 0 1rem 1rem var(--grey-1);
        background: var(--grey-5);
        color: var(--grey-1);
        padding: 0.5rem;

        input {
          background: none;
          border: none;
          margin: 0;
          padding: 0.5rem;
          color: var(--grey-2);
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
        }

        input::placeholder {
          font-family: 'Inter', sans-serif;
          color: var(--grey-3);
          font-size: 0.8rem;
        }

        input:focus {
          outline: none;
        }

        button {
          margin: 0 0.5rem;
          background: none;
          border: none;
          width: 1rem;
          height: 1rem;
          color: var(--grey-3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        button:focus,
        button.is-active {
          color: var(--grey-1);
        }

        button:hover {
          color: var(--grey-2);
        }

        html[data-theme='dark'] button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        html[data-theme='light'] button:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        
        .divider {
          width: 1px;
          background-color: var(--grey-3);
          height: 1.25rem;
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
          <button type="submit" onClick={() => {
            if (url) {
              editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: url })
                .run()
              
              setEditingLink(false)
            }
          }}>
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
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive('strike') ? 'is-active' : ''}
            title="Strikethrough"
          >
            <StrikethroughIcon />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={editor.isActive('code') ? 'is-active' : ''}
            title="Code"
          >
            <CodeIcon />
          </button>
          
          <div className="divider"></div>
          
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
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive('blockquote') ? 'is-active' : ''}
            title="Quote"
          >
            <QuoteIcon />
          </button>
          
          <div className="divider"></div>
          
          {editor.isActive('link') ? (
            <button 
              onClick={() => editor.chain().focus().unsetLink().run()}
              title="Remove Link"
            >
              <LinkBreak2Icon />
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingLink(true)
                const selection = editor.state.selection
                const text = editor.state.doc.textBetween(selection.from, selection.to)
                if (text && text.startsWith('http')) {
                  setUrl(text)
                } else {
                  setUrl('')
                }
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
  })

  const [slugErr, setSlugErr] = useState(false)

  useEffect(() => {
    setClientPost(post)
  }, [post])

  async function saveChanges() {
    let toSave = {
      ...clientPost,
      lastEdited: firebase.firestore.Timestamp.now(),
    }
    delete toSave.id // since we get the id from the document not the data
    await firestore.collection('posts').doc(post.id).set(toSave)
  }

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
  })

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
        codeBlock: {
          HTMLAttributes: {
            class: 'code-block',
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your post here...',
      }),
    ],
    onUpdate: ({ editor: newEditor }) => {
      setClientPost(prevPost => ({ ...prevPost, content: newEditor.getHTML() }))
    },
  })

  async function addImage() {
    // Create a file input element
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    
    // Listen for file selection
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      
      // Show loading indicator
      alert('Uploading image to ImgBB...')
      
      try {
        // Convert file to base64
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1]
          
          // Create form data for ImgBB API
          const formData = new FormData()
          formData.append('image', base64)
          
          // Upload to ImgBB using environment variable
          const response = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.NEXT_PUBLIC_IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
          })
          
          const data = await response.json()
          
          if (data.success) {
            // Get direct image URL and insert it
            const imageUrl = data.data.url
            contentEditor.chain().focus().setImage({ src: imageUrl }).run()
          } else {
            alert('Failed to upload image to ImgBB')
            console.error('ImgBB upload failed:', data)
          }
        }
      } catch (error) {
        alert('Error uploading image')
        console.error('Image upload error:', error)
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
        <Button
          css={css`
            margin-left: auto;
            margin-right: 1rem;
            font-size: 0.9rem;
          `}
          outline
          disabled={
            post.title === clientPost.title &&
            post.content === clientPost.content &&
            post.excerpt === clientPost.excerpt
          }
          onClick={saveChanges}
        >
          Save changes
        </Button>

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
                display: flex;

                button {
                  margin-left: 0;
                  margin-right: 1rem;
                }

                button:last-child {
                  margin-right: auto;
                }

                button {
                  font-size: 0.9rem;
                }
              `}
            >
              <Button
                onClick={async () => {
                  await firestore
                    .collection('posts')
                    .doc(post.id)
                    .update({ published: !post.published })
                }}
              >
                {post.published ? 'Make Draft' : 'Publish'}
              </Button>
              <Button
                outline
                onClick={async () => {
                  await removePostForUser(post.author, post.id)
                  router.push('/dashboard')
                }}
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
      </header>

      <Button
        outline
        css={css`
          font-size: 0.9rem;
          margin-top: 5rem;
          margin-bottom: 2.5rem;
        `}
        onClick={() => {
          addImage()
        }}
      >
        + Upload Image
      </Button>

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
        `}
      >
        {contentEditor && <SelectionMenu editor={contentEditor} />}
        <EditorContent editor={contentEditor} />
      </PostContainer>
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
