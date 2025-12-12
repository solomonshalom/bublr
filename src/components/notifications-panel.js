/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { auth, firestore } from '../lib/firebase'
import { getPostByID, getUserByID } from '../lib/db'
import { htmlToText } from 'html-to-text'
import { panelVariants, backdropVariants } from '../lib/animation-config'
import { LoadingContainer } from './loading-container'

// Notification type colors
const NOTIFICATION_COLORS = {
  subscriber: '#2ECC71', // Green - new subscriber
  follow: '#4D96FF', // Blue - new follower
  new_post: '#cf52f2', // Purple - new post from followed user
  like: '#E53E3E', // Red - post like
}

// Icons
const BookmarkIcon = ({ filled }) => (
  <svg width="18" height="18" viewBox="0 0 15 15" fill={filled ? 'currentColor' : 'none'} xmlns="http://www.w3.org/2000/svg">
    <path d="M3 2.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.765.424L7.5 11.59l-3.735 2.334A.5.5 0 0 1 3 13.5zM4 3v9.598l2.97-1.856a1 1 0 0 1 1.06 0L11 12.598V3z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
  </svg>
)

const BellIcon = ({ hasUnread }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    {hasUnread && <circle cx="18" cy="5" r="3" fill="#ef4444" stroke="#ef4444" />}
  </svg>
)

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const EnvelopeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const ArrowIcon = ({ direction }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {direction === 'right'
      ? <path d="M9 18l6-6-6-6" />
      : <path d="M15 18l-6-6 6-6" />
    }
  </svg>
)

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

// Format relative time
function formatRelativeTime(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else if (days > 0) {
    return `${days}d ago`
  } else if (hours > 0) {
    return `${hours}h ago`
  } else if (minutes > 0) {
    return `${minutes}m ago`
  } else {
    return 'Just now'
  }
}

// Generate notification message
function getNotificationMessage(notification) {
  switch (notification.type) {
    case 'subscriber':
      return `subscribed to your newsletter`
    case 'follow':
      return `started following you`
    case 'new_post':
      return `published a new post: "${notification.postTitle || 'Untitled'}"`
    case 'like':
      return `liked your post: "${notification.postTitle || 'Untitled'}"`
    default:
      return notification.message || 'New notification'
  }
}

// Single notification item
function NotificationItem({ notification, onMarkRead }) {
  const color = NOTIFICATION_COLORS[notification.type] || '#2ECC71'

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id)
    }
  }

  const content = (
    <div
      onClick={handleClick}
      css={css`
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 0.5rem;
        background: ${notification.read ? 'transparent' : 'var(--grey-1)'};
        border: 1px solid ${notification.read ? 'transparent' : 'var(--grey-2)'};
        cursor: pointer;
        transition: all 0.2s;
        position: relative;

        &:hover {
          background: var(--grey-1);
          border-color: var(--grey-2);
        }
      `}
    >
      {/* Color dot indicator */}
      <div
        css={css`
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${color};
          flex-shrink: 0;
          margin-top: 0.5rem;
        `}
      />

      {/* Avatar */}
      <img
        src={notification.actorPhoto || `https://api.dicebear.com/7.x/initials/svg?seed=${notification.actorName}`}
        alt={notification.actorName}
        css={css`
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        `}
      />

      {/* Content */}
      <div css={css`flex: 1; min-width: 0;`}>
        <p
          css={css`
            font-size: 0.85rem;
            color: var(--grey-4);
            line-height: 1.4;
            margin: 0;
          `}
        >
          <span css={css`font-weight: 500;`}>{notification.actorName}</span>{' '}
          {getNotificationMessage(notification)}
        </p>
        <span
          css={css`
            font-size: 0.75rem;
            color: var(--grey-3);
          `}
        >
          {formatRelativeTime(notification.createdAt)}
        </span>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div
          css={css`
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #ef4444;
            flex-shrink: 0;
            margin-top: 0.5rem;
          `}
        />
      )}
    </div>
  )

  // Wrap in link if we have a destination
  // For new_post notifications, link to the post
  if (notification.type === 'new_post' && notification.postSlug && notification.postAuthorName) {
    return (
      <Link href={`/${notification.postAuthorName}/${notification.postSlug}`}>
        <a css={css`text-decoration: none; display: block; color: inherit;`}>
          {content}
        </a>
      </Link>
    )
  }

  // For like notifications, link to the user who liked (same as follow)
  if (notification.type === 'like' && notification.actorUsername) {
    return (
      <Link href={`/${notification.actorUsername}`}>
        <a css={css`text-decoration: none; display: block; color: inherit;`}>
          {content}
        </a>
      </Link>
    )
  }

  // For follow notifications, link to the follower's profile
  // (actorUsername for new notifications, postAuthorName as fallback for existing ones)
  if (notification.type === 'follow') {
    const username = notification.actorUsername || notification.postAuthorName
    if (username) {
      return (
        <Link href={`/${username}`}>
          <a css={css`text-decoration: none; display: block; color: inherit;`}>
            {content}
          </a>
        </Link>
      )
    }
  }

  // Subscriber notifications don't link anywhere (they're anonymous email subscribers)
  return content
}

// Reading list item (reusing existing pattern)
function ReadingListItem({ post }) {
  return (
    <Link href={`/${post.author.name}/${post.slug}`}>
      <a
        css={css`
          display: block;
          padding: 0.75rem;
          border-radius: 0.5rem;
          text-decoration: none;
          color: inherit;
          cursor: pointer;
          transition: background 0.2s;

          &:hover {
            background: var(--grey-2);
          }
        `}
      >
        <h4
          css={css`
            font-size: 0.9rem;
            font-weight: 400;
            margin: 0 0 0.4rem 0;
            color: var(--grey-4);
          `}
        >
          {post.title ? htmlToText(post.title) : 'Untitled'}
        </h4>
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--grey-3);
            font-size: 0.8rem;
          `}
        >
          <img
            src={post.author.photo}
            alt={post.author.displayName}
            css={css`
              width: 1.25rem;
              height: 1.25rem;
              border-radius: 50%;
            `}
          />
          <span>{post.author.displayName}</span>
        </div>
      </a>
    </Link>
  )
}

// Subscriber item component
function SubscriberItem({ subscriber, onRemove, isRemoving }) {
  const email = typeof subscriber === 'string' ? subscriber : subscriber.email
  const subscribedAt = typeof subscriber === 'string' ? null : subscriber.subscribedAt

  return (
    <div
      css={css`
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 0.5rem;
        background: var(--grey-1);
        border: 1px solid var(--grey-2);
        margin-bottom: 0.5rem;
        transition: all 0.2s;

        &:hover {
          border-color: var(--grey-3);
        }
      `}
    >
      {/* Avatar using DiceBear Dylan style */}
      <img
        src={`https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(email)}`}
        alt={email}
        css={css`
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        `}
      />

      {/* Content */}
      <div css={css`flex: 1; min-width: 0;`}>
        <p
          css={css`
            font-size: 0.85rem;
            color: var(--grey-4);
            margin: 0;
            word-break: break-all;
            line-height: 1.4;
          `}
        >
          {email}
        </p>
        <span
          css={css`
            font-size: 0.75rem;
            color: var(--grey-3);
          `}
        >
          {subscribedAt
            ? `Subscribed ${formatRelativeTime(new Date(subscribedAt).getTime())}`
            : 'Subscribed'}
        </span>
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(subscriber)}
        disabled={isRemoving}
        css={css`
          background: none;
          border: none;
          color: var(--grey-3);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.25rem;
          transition: all 0.2s;
          opacity: ${isRemoving ? 0.5 : 1};
          flex-shrink: 0;
          margin-top: 0.25rem;

          &:hover:not(:disabled) {
            color: #dc2626;
            background: rgba(220, 38, 38, 0.1);
          }
        `}
      >
        <TrashIcon />
      </button>
    </div>
  )
}

// Following/Follower item component
function FollowingItem({ user: profile, onClose }) {
  return (
    <Link href={`/${profile.name}`}>
      <a
        onClick={onClose}
        css={css`
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
          text-decoration: none;
          color: inherit;
          transition: background 0.2s;

          &:hover {
            background: var(--grey-2);
          }
        `}
      >
        <img
          src={profile.photo || `https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(profile.name)}`}
          alt={profile.displayName}
          css={css`
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
            flex-shrink: 0;
          `}
        />
        <div css={css`flex: 1; min-width: 0;`}>
          <p
            css={css`
              font-size: 0.85rem;
              color: var(--grey-4);
              margin: 0;
              font-weight: 500;
            `}
          >
            @{profile.name}
          </p>
          <span
            css={css`
              font-size: 0.75rem;
              color: var(--grey-3);
            `}
          >
            {profile.displayName}
          </span>
        </div>
      </a>
    </Link>
  )
}

// Main Panel Component
export default function NotificationsPanel({ isOpen, onClose }) {
  const [user] = useAuthState(auth)
  const [activeTab, setActiveTab] = useState('notifications')
  const [notifications, setNotifications] = useState([])
  const [readingList, setReadingList] = useState([])
  const [subscribers, setSubscribers] = useState([])
  const [following, setFollowing] = useState([])
  const [followers, setFollowers] = useState([])
  const [followingView, setFollowingView] = useState('following')
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [removingSubscriber, setRemovingSubscriber] = useState(null)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const panelRef = useRef(null)
  const tabsRef = useRef(null)

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/notifications?userId=${user.uid}`)
      const data = await response.json()

      if (response.ok) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }

  // Fetch reading list
  const fetchReadingList = async () => {
    if (!user) return

    try {
      const userData = await getUserByID(user.uid)
      const postPromises = (userData.readingList || []).map(async (pid) => {
        try {
          const post = await getPostByID(pid)
          const authorDoc = await firestore.collection('users').doc(post.author).get()
          post.author = authorDoc.data()
          return post
        } catch {
          return null
        }
      })
      const posts = await Promise.all(postPromises)
      setReadingList(posts.filter(Boolean))
    } catch (err) {
      console.error('Failed to fetch reading list:', err)
    }
  }

  // Fetch subscribers and following data together (single user fetch)
  const fetchSubscribersAndFollowing = async () => {
    if (!user) return

    try {
      const userData = await getUserByID(user.uid)

      // Set subscribers
      setSubscribers(userData.subscribers || [])

      // Fetch following/followers profiles
      const followingIds = userData.following || []
      const followerIds = userData.followers || []

      // Combine unique IDs to minimize duplicate fetches
      const allIds = [...new Set([...followingIds, ...followerIds])]

      // Batch fetch all profiles at once
      const profileMap = new Map()
      if (allIds.length > 0) {
        const profiles = await Promise.all(
          allIds.map(id => getUserByID(id).catch(() => null))
        )
        profiles.forEach((profile, idx) => {
          if (profile) {
            profileMap.set(allIds[idx], profile)
          }
        })
      }

      // Map IDs to profiles
      setFollowing(followingIds.map(id => profileMap.get(id)).filter(Boolean))
      setFollowers(followerIds.map(id => profileMap.get(id)).filter(Boolean))
    } catch (err) {
      console.error('Failed to fetch subscribers/following:', err)
    }
  }

  // Check scroll position for tabs
  const checkScrollPosition = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  // Handle scroll tabs button click
  const handleScrollTabs = () => {
    if (tabsRef.current) {
      const { scrollWidth, clientWidth } = tabsRef.current
      if (canScrollRight) {
        tabsRef.current.scrollTo({ left: scrollWidth - clientWidth, behavior: 'smooth' })
      } else {
        tabsRef.current.scrollTo({ left: 0, behavior: 'smooth' })
      }
      // Update state after animation
      setTimeout(checkScrollPosition, 300)
    }
  }

  // Load data when panel opens
  useEffect(() => {
    if (isOpen && user) {
      setIsLoading(true)
      Promise.all([fetchNotifications(), fetchReadingList(), fetchSubscribersAndFollowing()]).finally(() => {
        setIsLoading(false)
      })
    }
  }, [isOpen, user])

  // Check scroll position on mount and resize
  useEffect(() => {
    if (isOpen) {
      checkScrollPosition()
      window.addEventListener('resize', checkScrollPosition)
      return () => window.removeEventListener('resize', checkScrollPosition)
    }
  }, [isOpen])

  // Mark notification as read
  const handleMarkRead = async (notificationId) => {
    if (!user) return

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, userId: user.uid }),
      })

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (!user) return

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, markAllRead: true }),
      })

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  // Remove subscriber
  const handleRemoveSubscriber = async (subscriber) => {
    const email = typeof subscriber === 'string' ? subscriber : subscriber.email

    if (!window.confirm(`Remove ${email} from your newsletter subscribers?`)) {
      return
    }

    setRemovingSubscriber(email)

    try {
      // Filter out the subscriber (handle both string and object formats)
      const updatedSubscribers = subscribers.filter((sub) => {
        const subEmail = typeof sub === 'string' ? sub : sub.email
        return subEmail.toLowerCase() !== email.toLowerCase()
      })

      // Update Firestore
      await firestore.collection('users').doc(user.uid).update({
        subscribers: updatedSubscribers,
      })

      // Update local state (optimistic update already done visually)
      setSubscribers(updatedSubscribers)
    } catch (err) {
      console.error('Failed to remove subscriber:', err)
      // Refresh subscribers on error
      fetchSubscribersAndFollowing()
    } finally {
      setRemovingSubscriber(null)
    }
  }

  // Export subscribers to CSV
  const handleExportCSV = () => {
    if (subscribers.length === 0) return

    // Build CSV content
    const csvRows = ['email,subscribed_at']

    subscribers.forEach((sub) => {
      const email = typeof sub === 'string' ? sub : sub.email
      const subscribedAt = typeof sub === 'string' ? '' : (sub.subscribedAt || '')

      // Escape email if it contains commas or quotes
      const escapedEmail = email.includes(',') || email.includes('"')
        ? `"${email.replace(/"/g, '""')}"`
        : email

      csvRows.push(`${escapedEmail},${subscribedAt}`)
    })

    const csvContent = csvRows.join('\n')

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Close on escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            css={css`
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.2);
              z-index: 999;
            `}
          />
          {/* Panel */}
          <motion.div
            ref={panelRef}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            css={css`
              position: fixed;
              top: 0;
              right: 0;
              width: 100%;
              max-width: 380px;
              height: 100vh;
              background: var(--grey-1);
              border-left: 1px solid var(--grey-2);
              z-index: 1000;
              display: flex;
              flex-direction: column;
              box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
              overflow: hidden;

              @media (max-width: 480px) {
                max-width: 100%;
              }
            `}
          >
      {/* Header */}
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid var(--grey-2);
        `}
      >
        <h2
          css={css`
            font-size: 1rem;
            font-weight: 500;
            margin: 0;
            color: var(--grey-4);
          `}
        >
          {activeTab === 'notifications' ? 'Notifications' : activeTab === 'bookmarks' ? 'Bookmarks' : activeTab === 'subscribers' ? 'Subscribers' : 'Following'}
        </h2>
        <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
          {/* Scroll navigation arrow */}
          <button
            onClick={handleScrollTabs}
            css={css`
              background: none;
              border: 1px solid var(--grey-2);
              color: var(--grey-3);
              cursor: pointer;
              padding: 0.25rem;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 24px;
              height: 24px;
              transition: all 0.2s;

              &:hover {
                color: var(--grey-4);
                border-color: var(--grey-3);
              }
            `}
          >
            <ArrowIcon direction={canScrollRight ? 'right' : 'left'} />
          </button>
          {activeTab === 'notifications' && unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              css={css`
                background: none;
                border: none;
                color: var(--grey-3);
                font-size: 0.75rem;
                cursor: pointer;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;

                &:hover {
                  color: var(--grey-4);
                  background: var(--grey-2);
                }
              `}
            >
              Mark all read
            </button>
          )}
          {activeTab === 'subscribers' && subscribers.length > 0 && (
            <button
              onClick={handleExportCSV}
              css={css`
                background: none;
                border: 1px solid var(--grey-2);
                color: var(--grey-3);
                font-size: 0.75rem;
                cursor: pointer;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                display: flex;
                align-items: center;
                gap: 0.25rem;

                &:hover {
                  color: var(--grey-4);
                  border-color: var(--grey-3);
                }
              `}
            >
              <DownloadIcon />
              Export
            </button>
          )}
          <button
            onClick={onClose}
            css={css`
              background: none;
              border: none;
              color: var(--grey-3);
              cursor: pointer;
              padding: 0.25rem;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 0.25rem;

              &:hover {
                color: var(--grey-4);
                background: var(--grey-2);
              }
            `}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        ref={tabsRef}
        onScroll={checkScrollPosition}
        css={css`
          display: flex;
          border-bottom: 1px solid var(--grey-2);
          overflow-x: auto;
          overflow-y: hidden;

          /* Hide scrollbar for Chrome, Safari and Opera */
          &::-webkit-scrollbar {
            display: none;
          }

          /* Hide scrollbar for IE, Edge and Firefox */
          -ms-overflow-style: none;
          scrollbar-width: none;
        `}
      >
        <button
          onClick={() => setActiveTab('notifications')}
          css={css`
            flex: 1;
            flex-shrink: 0;
            min-width: fit-content;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem;
            background: none;
            border: none;
            border-bottom: 2px solid ${activeTab === 'notifications' ? 'var(--grey-4)' : 'transparent'};
            color: ${activeTab === 'notifications' ? 'var(--grey-4)' : 'var(--grey-3)'};
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.85rem;
            white-space: nowrap;

            &:hover {
              color: var(--grey-4);
            }
          `}
        >
          <BellIcon hasUnread={unreadCount > 0} />
          Notifications
          {unreadCount > 0 && (
            <span
              css={css`
                background: #ef4444;
                color: white;
                font-size: 0.7rem;
                padding: 0.1rem 0.4rem;
                border-radius: 10px;
                font-weight: 500;
              `}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('bookmarks')}
          css={css`
            flex: 1;
            flex-shrink: 0;
            min-width: fit-content;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem;
            background: none;
            border: none;
            border-bottom: 2px solid ${activeTab === 'bookmarks' ? 'var(--grey-4)' : 'transparent'};
            color: ${activeTab === 'bookmarks' ? 'var(--grey-4)' : 'var(--grey-3)'};
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.85rem;
            white-space: nowrap;

            &:hover {
              color: var(--grey-4);
            }
          `}
        >
          <BookmarkIcon filled={activeTab === 'bookmarks'} />
          Bookmarks
          {readingList.length > 0 && (
            <span
              css={css`
                background: var(--grey-2);
                color: var(--grey-4);
                font-size: 0.7rem;
                padding: 0.1rem 0.4rem;
                border-radius: 10px;
              `}
            >
              {readingList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('subscribers')}
          css={css`
            flex: 1;
            flex-shrink: 0;
            min-width: fit-content;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem;
            background: none;
            border: none;
            border-bottom: 2px solid ${activeTab === 'subscribers' ? 'var(--grey-4)' : 'transparent'};
            color: ${activeTab === 'subscribers' ? 'var(--grey-4)' : 'var(--grey-3)'};
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.85rem;
            white-space: nowrap;

            &:hover {
              color: var(--grey-4);
            }
          `}
        >
          <EnvelopeIcon />
          Subscribers
          {subscribers.length > 0 && (
            <span
              css={css`
                background: var(--grey-2);
                color: var(--grey-4);
                font-size: 0.7rem;
                padding: 0.1rem 0.4rem;
                border-radius: 10px;
              `}
            >
              {subscribers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('following')}
          css={css`
            flex: 1;
            flex-shrink: 0;
            min-width: fit-content;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem;
            background: none;
            border: none;
            border-bottom: 2px solid ${activeTab === 'following' ? 'var(--grey-4)' : 'transparent'};
            color: ${activeTab === 'following' ? 'var(--grey-4)' : 'var(--grey-3)'};
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.85rem;
            white-space: nowrap;

            &:hover {
              color: var(--grey-4);
            }
          `}
        >
          <UsersIcon />
          Following
          {following.length > 0 && (
            <span
              css={css`
                background: var(--grey-2);
                color: var(--grey-4);
                font-size: 0.7rem;
                padding: 0.1rem 0.4rem;
                border-radius: 10px;
              `}
            >
              {following.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div
        data-lenis-prevent
        css={css`
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;

          /* Hide scrollbar for Chrome, Safari and Opera */
          &::-webkit-scrollbar {
            display: none;
          }

          /* Hide scrollbar for IE, Edge and Firefox */
          -ms-overflow-style: none;
          scrollbar-width: none;
        `}
      >
        {isLoading ? (
          <LoadingContainer isLoading={true}>
            <div css={css`min-height: 150px;`} />
          </LoadingContainer>
        ) : activeTab === 'notifications' ? (
          notifications.length > 0 ? (
            <div css={css`display: flex; flex-direction: column; gap: 0.25rem;`}>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
          ) : (
            <div
              css={css`
                text-align: center;
                padding: 3rem 1rem;
                color: var(--grey-3);
              `}
            >
              <BellIcon hasUnread={false} />
              <p css={css`margin-top: 0.5rem; font-size: 0.9rem;`}>
                No notifications yet
              </p>
              <p css={css`font-size: 0.8rem; margin-top: 0.25rem;`}>
                You'll see new subscribers and more here
              </p>
            </div>
          )
        ) : activeTab === 'bookmarks' ? (
          readingList.length > 0 ? (
            <div css={css`display: flex; flex-direction: column;`}>
              {readingList.map((post) => (
                <ReadingListItem key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div
              css={css`
                text-align: center;
                padding: 3rem 1rem;
                color: var(--grey-3);
              `}
            >
              <BookmarkIcon filled={false} />
              <p css={css`margin-top: 0.5rem; font-size: 0.9rem;`}>
                No bookmarks yet
              </p>
              <p css={css`font-size: 0.8rem; margin-top: 0.25rem;`}>
                Save posts to read later
              </p>
            </div>
          )
        ) : activeTab === 'subscribers' ? (
          // Subscribers tab
          subscribers.length > 0 ? (
            <div css={css`display: flex; flex-direction: column;`}>
              {subscribers.map((subscriber, index) => {
                const email = typeof subscriber === 'string' ? subscriber : subscriber.email
                return (
                  <SubscriberItem
                    key={email + index}
                    subscriber={subscriber}
                    onRemove={handleRemoveSubscriber}
                    isRemoving={removingSubscriber === email}
                  />
                )
              })}
            </div>
          ) : (
            <div
              css={css`
                text-align: center;
                padding: 3rem 1rem;
                color: var(--grey-3);
              `}
            >
              <EnvelopeIcon />
              <p css={css`margin-top: 0.5rem; font-size: 0.9rem;`}>
                No subscribers yet
              </p>
              <p css={css`font-size: 0.8rem; margin-top: 0.25rem;`}>
                Share your profile to grow your newsletter
              </p>
            </div>
          )
        ) : (
          // Following tab
          <div>
            {/* Sub-toggle for Following/Followers */}
            <div
              css={css`
                display: flex;
                gap: 0.5rem;
                padding: 0.5rem;
                border-bottom: 1px solid var(--grey-2);
                margin-bottom: 0.5rem;
              `}
            >
              <button
                onClick={() => setFollowingView('following')}
                css={css`
                  flex: 1;
                  padding: 0.5rem;
                  background: ${followingView === 'following' ? 'var(--grey-2)' : 'transparent'};
                  border: none;
                  border-radius: 0.25rem;
                  color: var(--grey-4);
                  font-size: 0.8rem;
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover {
                    background: var(--grey-2);
                  }
                `}
              >
                Following ({following.length})
              </button>
              <button
                onClick={() => setFollowingView('followers')}
                css={css`
                  flex: 1;
                  padding: 0.5rem;
                  background: ${followingView === 'followers' ? 'var(--grey-2)' : 'transparent'};
                  border: none;
                  border-radius: 0.25rem;
                  color: var(--grey-4);
                  font-size: 0.8rem;
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover {
                    background: var(--grey-2);
                  }
                `}
              >
                Followers ({followers.length})
              </button>
            </div>

            {/* Content based on sub-view */}
            {followingView === 'following' ? (
              following.length > 0 ? (
                <div css={css`display: flex; flex-direction: column;`}>
                  {following.map((profile) => (
                    <FollowingItem key={profile.id || profile.name} user={profile} onClose={onClose} />
                  ))}
                </div>
              ) : (
                <div
                  css={css`
                    text-align: center;
                    padding: 3rem 1rem;
                    color: var(--grey-3);
                  `}
                >
                  <UsersIcon />
                  <p css={css`margin-top: 0.5rem; font-size: 0.9rem;`}>
                    You're not following anyone yet
                  </p>
                  <p css={css`font-size: 0.8rem; margin-top: 0.25rem;`}>
                    Follow writers to see their posts
                  </p>
                </div>
              )
            ) : (
              followers.length > 0 ? (
                <div css={css`display: flex; flex-direction: column;`}>
                  {followers.map((profile) => (
                    <FollowingItem key={profile.id || profile.name} user={profile} onClose={onClose} />
                  ))}
                </div>
              ) : (
                <div
                  css={css`
                    text-align: center;
                    padding: 3rem 1rem;
                    color: var(--grey-3);
                  `}
                >
                  <UsersIcon />
                  <p css={css`margin-top: 0.5rem; font-size: 0.9rem;`}>
                    No followers yet
                  </p>
                  <p css={css`font-size: 0.8rem; margin-top: 0.25rem;`}>
                    Share your profile to grow your audience
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Export the trigger button component
export function NotificationsTrigger({ onClick, unreadCount = 0 }) {
  return (
    <button
      onClick={onClick}
      css={css`
        position: relative;
        background: none;
        border: none;
        color: var(--grey-2);
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;

        &:hover {
          color: var(--grey-3);
        }
      `}
    >
      {/* Combined bookmark + bell icon */}
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Bookmark base */}
        <path
          d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v17l-7-4-7 4V4z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Small bell inside */}
        <path
          d="M12 7a2.5 2.5 0 0 0-2.5 2.5c0 2.5-1 3.5-1 3.5h7s-1-1-1-3.5A2.5 2.5 0 0 0 12 7z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M11 14h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span
          css={css`
            position: absolute;
            top: -4px;
            right: -4px;
            background: #ef4444;
            color: white;
            font-size: 0.6rem;
            min-width: 14px;
            height: 14px;
            padding: 0 3px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
          `}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
