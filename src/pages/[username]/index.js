/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { css, Global, keyframes } from '@emotion/react'
import { htmlToText } from 'html-to-text'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

import { useAuthState } from 'react-firebase-hooks/auth'
import { auth, firestore } from '../../lib/firebase'
import { getUserByName } from '../../lib/db'
import { hasActiveAccess } from '../../lib/subscription'

import meta from '../../components/meta'
import { generateProfilePageSchema, generateOrganizationSchema } from '../../lib/seo-utils'
import SubscribeNewsletter from '../../components/subscribe-newsletter'
import FollowButton from '../../components/follow-button'
import { ProfileCanvas } from '../../components/profile-canvas'
import { sanitizeFontFamily } from '../../lib/fonts'

// Color palette for dots (same as berrysauce)
const COLOR_PALETTE = ['#cf52f2', '#6BCB77', '#4D96FF', '#A66CFF', '#E23E57', '#ff3e00']

// Get color - use custom color if set, otherwise cycle through palette
const getSkillColor = (index) => {
  return COLOR_PALETTE[index % COLOR_PALETTE.length]
}

const getPostColor = (post) => {
  // If post has a custom color set, use it
  if (post.dotColor && COLOR_PALETTE.includes(post.dotColor)) {
    return post.dotColor
  }
  // Generate a consistent random color based on post id
  const hash = post.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return COLOR_PALETTE[hash % COLOR_PALETTE.length]
}

// Format date like "2nd Nov'25"
const formatShortDate = (date) => {
  const d = new Date(date)
  const day = d.getDate()
  const month = d.toLocaleString('en-US', { month: 'short' })
  const year = d.getFullYear().toString().slice(-2)

  // Add ordinal suffix
  const suffix = (day === 1 || day === 21 || day === 31) ? 'st'
    : (day === 2 || day === 22) ? 'nd'
    : (day === 3 || day === 23) ? 'rd'
    : 'th'

  return `${day}${suffix} ${month}'${year}`
}

// Colored dot SVG component (exactly like berrysauce)
const ColorDot = ({ color }) => (
  <svg
    css={css`
      font-size: 10px;
      margin-top: -3px;
      margin-right: 5px;
      vertical-align: middle;
    `}
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke={color}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path
      d="M7 3.34a10 10 0 1 1 -4.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 4.995 -8.336z"
      strokeWidth="0"
      fill={color}
    />
  </svg>
)

// Social icon components (exactly like berrysauce - 18px, using 1em)
const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8" />
  </svg>
)

const TwitterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
    <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" />
  </svg>
)

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
    <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334" />
  </svg>
)

const LinkedInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
    <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z" />
  </svg>
)

const YouTubeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
    <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31 31 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A100 100 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z" />
  </svg>
)

const EmailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M22 7.535v9.465a3 3 0 0 1 -2.824 2.995l-.176 .005h-14a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-9.465l9.445 6.297l.116 .066a1 1 0 0 0 .878 0l.116 -.066l9.445 -6.297z" strokeWidth="0" fill="currentColor" />
    <path d="M19 4c1.08 0 2.027 .57 2.555 1.427l-9.555 6.37l-9.555 -6.37a2.999 2.999 0 0 1 2.354 -1.42l.201 -.007h14z" strokeWidth="0" fill="currentColor" />
  </svg>
)

const WebsiteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M6 15h15" />
    <path d="M21 19h-15" />
    <path d="M15 11h6" />
    <path d="M21 7h-6" />
    <path d="M9 9h1a1 1 0 1 1 -1 1v-2.5a2 2 0 0 1 2 -2" />
    <path d="M3 9h1a1 1 0 1 1 -1 1v-2.5a2 2 0 0 1 2 -2" />
  </svg>
)

// Global styles - only applies Inter font import
const globalStyles = css`
  @import url('https://fonts.bunny.net/css?family=inter:400,500');
`

// Gradient animation for avatar frames
const gradientRotate = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`

// Frame size mapping
const FRAME_SIZES = {
  small: 2,
  medium: 3,
  large: 4,
}

// Avatar with Frame component
const AvatarWithFrame = ({ user, size = 48 }) => {
  const frame = user.avatarFrame || { type: 'none' }
  const frameSize = FRAME_SIZES[frame.size] || 3

  // No frame - just the avatar
  if (frame.type === 'none' || !frame.type) {
    return (
      <img
        src={user.photo}
        alt={`${user.displayName}'s profile picture`}
        width={size}
        height={size}
        loading="eager"
        css={css`
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          object-fit: cover;
        `}
      />
    )
  }

  // Solid color frame
  if (frame.type === 'solid') {
    return (
      <img
        src={user.photo}
        alt={`${user.displayName}'s profile picture`}
        width={size}
        height={size}
        loading="eager"
        css={css`
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          object-fit: cover;
          border: ${frameSize}px solid ${frame.color || COLOR_PALETTE[0]};
        `}
      />
    )
  }

  // Gradient frame
  if (frame.type === 'gradient') {
    const colors = frame.gradientColors || [COLOR_PALETTE[0], COLOR_PALETTE[2]]
    return (
      <div
        css={css`
          display: inline-block;
          padding: ${frameSize}px;
          border-radius: 50%;
          background: linear-gradient(45deg, ${colors[0]}, ${colors[1]}, ${colors[0]});
          background-size: 200% 200%;
          animation: ${gradientRotate} 3s ease infinite;
        `}
      >
        <img
          src={user.photo}
          alt={`${user.displayName}'s profile picture`}
          width={size}
          height={size}
          loading="eager"
          css={css`
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            object-fit: cover;
            display: block;
          `}
        />
      </div>
    )
  }

  // Custom PNG overlay frame
  if (frame.type === 'custom' && frame.customUrl) {
    const frameOverlaySize = size + 16 // 8px overflow on each side
    return (
      <div
        css={css`
          position: relative;
          display: inline-block;
          width: ${size}px;
          height: ${size}px;
        `}
      >
        <img
          src={user.photo}
          alt={`${user.displayName}'s profile picture`}
          width={size}
          height={size}
          loading="eager"
          css={css`
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            object-fit: cover;
          `}
        />
        <img
          src={frame.customUrl}
          alt=""
          aria-hidden="true"
          css={css`
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${frameOverlaySize}px;
            height: ${frameOverlaySize}px;
            pointer-events: none;
          `}
        />
      </div>
    )
  }

  // Fallback - no frame
  return (
    <img
      src={user.photo}
      alt={`${user.displayName}'s profile picture`}
      width={size}
      height={size}
      loading="eager"
      css={css`
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        object-fit: cover;
      `}
    />
  )
}

export default function Profile({ user, organizationSchema, profilePageSchema, customFonts }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [currentUser] = useAuthState(auth)
  const [isFollowing, setIsFollowing] = useState(false)
  const currentYear = new Date().getFullYear()

  // Ensure we only render theme-dependent UI after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if current user is following this profile
  useEffect(() => {
    async function checkFollowStatus() {
      if (!currentUser || currentUser.uid === user.id) return

      try {
        const userDoc = await firestore.collection('users').doc(currentUser.uid).get()
        if (userDoc.exists) {
          const following = userDoc.data().following || []
          setIsFollowing(following.includes(user.id))
        }
      } catch (err) {
        console.error('Error checking follow status:', err)
      }
    }

    if (mounted && currentUser) {
      checkFollowStatus()
    }
  }, [mounted, currentUser, user.id])

  // Use resolvedTheme when mounted, otherwise default to a neutral state
  const isDark = mounted ? resolvedTheme === 'dark' : false

  const hasSocialLinks = user.socialLinks && Object.values(user.socialLinks).some(v => v)
  const hasSkills = user.skills && user.skills.length > 0
  const hasCustomSections = user.customSections && user.customSections.length > 0

  // Theme-aware colors (matching app's --grey-1)
  const colors = {
    bg: isDark ? '#171717' : '#ffffff',
    text: isDark ? 'rgb(229, 231, 235)' : 'rgb(33, 37, 41)',
    muted: isDark ? 'rgba(229, 231, 235, 0.6)' : 'rgba(33, 37, 41, 0.6)',
    mutedLight: isDark ? 'rgba(229, 231, 235, 0.3)' : 'rgba(33, 37, 41, 0.3)',
    border: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgb(222, 223, 223)',
    hoverText: isDark ? 'rgb(229, 231, 235)' : 'rgb(33, 37, 41)',
    hoverIcon: isDark ? '#ffffff' : '#000000',
  }

  return (
    <>
      <Global styles={globalStyles} />
      <Head>
        {meta({
          title: `${user.displayName} (@${user.name}) | Bublr`,
          description: user.about || `Check out ${user.displayName}'s writing on Bublr, an open-source community for writers.`,
          url: `/${user.name}`,
          image: user.photo,
          keywords: `${user.displayName}, ${user.name}, writer, author, blog, writing`
        })}
        <link rel="canonical" href={`https://bublr.life/${user.name}`} />

        {/* Load custom Google Fonts if needed */}
        {customFonts && customFonts.length > 0 && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
              href={`https://fonts.googleapis.com/css2?${customFonts.map(f =>
                `family=${encodeURIComponent(f)}:wght@400;500;600;700`
              ).join('&')}&display=swap`}
              rel="stylesheet"
            />
          </>
        )}
      </Head>

      {/* Main body - isolated styles that don't affect other pages */}
      <ProfileCanvas
        userId={currentUser?.uid}
        profileOwnerId={user.id}
        initialDecorations={user.profileDecorations?.items || []}
      >
      <div
        css={css`
          margin: 0;
          font-family: Inter, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.5;
          color: ${mounted ? colors.text : 'var(--grey-4)'};
          text-align: left;
          background-color: var(--grey-1);
          min-height: 100vh;
          -webkit-text-size-adjust: 100%;
          -webkit-tap-highlight-color: transparent;

          /* FOUC prevention - fade in once theme is resolved */
          opacity: ${mounted ? 1 : 0};
          transition: opacity 0.25s ease-out, background-color 0.3s ease, color 0.3s ease;

          *, ::after, ::before {
            box-sizing: border-box;
          }

          a {
            color: inherit;
            cursor: pointer;
          }

          p {
            display: block;
            margin-top: 0px;
            margin-bottom: 0px;
            text-align: left;
          }
        `}
      >
        {/* Profile Banner */}
        {user.banner && (
          <div
            css={css`
              width: 100%;
              max-width: ${(user.bannerStyle || 'rounded') === 'full' ? 'none' : '550px'};
              margin: 0 auto;
              padding: ${(user.bannerStyle || 'rounded') === 'full' ? '0' : '0 0.75rem'};

              @media (min-width: 992px) {
                padding: 0;
              }
            `}
          >
            <div
              css={css`
                width: 100%;
                height: ${(user.bannerStyle || 'rounded') === 'full' ? '180px' : '150px'};
                border-radius: ${(user.bannerStyle || 'rounded') === 'full' ? '0' : '12px'};
                overflow: hidden;
                position: relative;
                margin-top: ${(user.bannerStyle || 'rounded') === 'full' ? '0' : '1.5rem'};

                @media (min-width: 992px) {
                  height: ${(user.bannerStyle || 'rounded') === 'full' ? '240px' : '200px'};
                  margin-top: ${(user.bannerStyle || 'rounded') === 'full' ? '0' : '3rem'};
                }
              `}
            >
              <img
                src={user.banner}
                alt={`${user.displayName}'s banner`}
                css={css`
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  object-position: center ${user.bannerPosition || 'center'};
                `}
              />
              {/* Dark overlay for better contrast */}
              {(user.bannerOverlay === 'dark' || user.bannerOverlay === 'darker') && (
                <div
                  css={css`
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, ${user.bannerOverlay === 'darker' ? '0.35' : '0.15'});
                    pointer-events: none;
                  `}
                />
              )}
              {/* Gradient overlay at bottom for smooth transition */}
              {(user.bannerFade || 'subtle') !== 'none' && (
                <div
                  css={css`
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: ${
                      (user.bannerFade || 'subtle') === 'subtle' ? '60px' :
                      (user.bannerFade || 'subtle') === 'medium' ? '100px' : '150px'
                    };
                    background: linear-gradient(to top, ${colors.bg}, transparent);
                    pointer-events: none;
                  `}
                />
              )}
            </div>
          </div>
        )}

        {/* Section */}
        <section
          css={css`
            padding-top: ${user.banner ? '0.5rem' : '1.5rem'};
            padding-bottom: 1.5rem;

            @media (min-width: 992px) {
              padding: ${user.banner ? '0.5rem 3rem 3rem 3rem' : '3rem'};
            }

            @media (min-width: 1200px) {
              padding-top: ${user.banner ? '0.5rem' : '3rem'};
              padding-bottom: 3rem;
            }
          `}
        >
          {/* Container */}
          <div
            css={css`
              max-width: 550px;
              width: 100%;
              padding-right: 0.75rem;
              padding-left: 0.75rem;
              margin-right: auto;
              margin-left: auto;
            `}
          >
            {/* Content box */}
            <div
              css={css`
                padding: 1.5rem;

                @media (min-width: 992px) {
                  padding: 3rem;
                }
              `}
            >
              {/* Avatar with optional frame */}
              <AvatarWithFrame user={user} size={48} />

              {/* Name */}
              <h1
                css={css`
                  font-size: 1.25rem;
                  font-weight: 500;
                  margin-top: 32px;
                  margin-bottom: 8px;
                  line-height: 1.2;
                `}
              >
                {user.displayName}
              </h1>

              {/* Bio */}
              <p css={css`color: ${colors.muted};`}>
                {user.about}

                {/* Social Links */}
                {(hasSocialLinks || user.link) && (
                  <>
                    <br /><br />
                    <span
                      css={css`
                        margin-top: -2px;

                        a {
                          text-decoration: none;
                          margin-right: 10px;
                          color: inherit;
                          display: inline-block;
                        }

                        svg {
                          fill: ${colors.mutedLight};
                          color: ${colors.mutedLight};
                          transition: 0.5s ease-in-out;
                          font-size: 18px;
                          vertical-align: middle;
                        }

                        a:hover svg {
                          fill: ${colors.hoverIcon};
                          color: ${colors.hoverIcon};
                        }

                        .social-lg {
                          margin-bottom: -1px;
                          font-size: 20px;
                        }

                        .social-xl {
                          margin-bottom: -2px;
                        }
                      `}
                    >
                      {user.socialLinks?.github && (
                        <a href={`https://github.com/${user.socialLinks.github}`} target="_blank" rel="noreferrer" aria-label="GitHub">
                          <GitHubIcon />
                        </a>
                      )}
                      {user.socialLinks?.twitter && (
                        <a href={`https://twitter.com/${user.socialLinks.twitter}`} target="_blank" rel="noreferrer" aria-label="Twitter/X">
                          <TwitterIcon />
                        </a>
                      )}
                      {user.socialLinks?.instagram && (
                        <a href={`https://instagram.com/${user.socialLinks.instagram}`} target="_blank" rel="noreferrer" aria-label="Instagram">
                          <InstagramIcon />
                        </a>
                      )}
                      {user.socialLinks?.linkedin && (
                        <a href={`https://linkedin.com/in/${user.socialLinks.linkedin}`} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                          <LinkedInIcon />
                        </a>
                      )}
                      {user.socialLinks?.youtube && (
                        <a href={`https://youtube.com/@${user.socialLinks.youtube}`} target="_blank" rel="noreferrer" aria-label="YouTube">
                          <YouTubeIcon />
                        </a>
                      )}
                      {user.socialLinks?.email && (
                        <a href={`mailto:${user.socialLinks.email}`} aria-label="Email" css={css`svg { font-size: 20px; margin-bottom: -1px; }`}>
                          <EmailIcon />
                        </a>
                      )}
                      {user.link && (
                        <a href={user.link.startsWith('http') ? user.link : `https://${user.link}`} target="_blank" rel="noreferrer" aria-label="Website" css={css`svg { margin-bottom: -2px; }`}>
                          <WebsiteIcon />
                        </a>
                      )}
                    </span>
                  </>
                )}
              </p>

              {/* Stats: Followers, Following, Subscribers - customizable */}
              {(() => {
                const statsOrder = user.statsOrder || ['followers', 'following', 'subscribers']
                const statsVisibility = user.statsVisibility || { followers: false, following: false, subscribers: false }
                const statsStyle = user.statsStyle || 'separator' // 'inline', 'stacked', 'separator'
                const statsAlignment = user.statsAlignment || 'center' // 'left', 'center', 'right'
                const visibleStats = statsOrder.filter(stat => statsVisibility[stat] !== false)

                if (visibleStats.length === 0) return null

                const getStatValue = (stat) => {
                  switch (stat) {
                    case 'followers': return user.followers?.length || 0
                    case 'following': return user.following?.length || 0
                    case 'subscribers': return user.subscribers?.length || 0
                    default: return 0
                  }
                }

                const alignmentStyle = statsAlignment === 'center'
                  ? 'justify-content: center;'
                  : statsAlignment === 'right'
                    ? 'justify-content: flex-end;'
                    : 'justify-content: flex-start;'

                // Stacked style (number on top, label below)
                if (statsStyle === 'stacked') {
                  return (
                    <div
                      css={css`
                        display: flex;
                        gap: 24px;
                        margin-top: 20px;
                        padding: 16px 0;
                        border-top: 1px solid ${colors.border};
                        border-bottom: 1px solid ${colors.border};
                        ${alignmentStyle}
                      `}
                    >
                      {visibleStats.map((stat) => (
                        <div
                          key={stat}
                          css={css`
                            text-align: center;
                            cursor: default;
                          `}
                        >
                          <p
                            css={css`
                              font-size: 1.1rem;
                              font-weight: 500;
                              color: ${colors.text};
                              margin: 0;
                            `}
                          >
                            {getStatValue(stat)}
                          </p>
                          <p
                            css={css`
                              font-size: 12px;
                              color: ${colors.muted};
                              margin: 0;
                            `}
                          >
                            {stat}
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                }

                // Separator style (with // between stats)
                if (statsStyle === 'separator') {
                  return (
                    <div
                      css={css`
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        margin-top: 20px;
                        padding: 16px 0;
                        border-top: 1px solid ${colors.border};
                        border-bottom: 1px solid ${colors.border};
                        ${alignmentStyle}
                      `}
                    >
                      {visibleStats.map((stat, index) => (
                        <div key={stat} css={css`display: flex; align-items: center;`}>
                          <div css={css`cursor: default;`}>
                            <span
                              css={css`
                                font-size: 1.1rem;
                                font-weight: 500;
                                color: ${colors.text};
                              `}
                            >
                              {getStatValue(stat)}
                            </span>
                            <span
                              css={css`
                                font-size: 12px;
                                color: ${colors.muted};
                                margin-left: 6px;
                              `}
                            >
                              {stat}
                            </span>
                          </div>
                          {index < visibleStats.length - 1 && (
                            <span
                              css={css`
                                color: ${colors.mutedLight};
                                margin-left: 12px;
                                font-size: 12px;
                              `}
                            >
                              //
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                }

                // Inline style (default - number followed by label)
                return (
                  <div
                    css={css`
                      display: flex;
                      gap: 24px;
                      margin-top: 20px;
                      padding: 16px 0;
                      border-top: 1px solid ${colors.border};
                      border-bottom: 1px solid ${colors.border};
                      ${alignmentStyle}
                    `}
                  >
                    {visibleStats.map((stat) => (
                      <div
                        key={stat}
                        css={css`
                          cursor: default;
                        `}
                      >
                        <span
                          css={css`
                            font-size: 1.1rem;
                            font-weight: 500;
                            color: ${colors.text};
                          `}
                        >
                          {getStatValue(stat)}
                        </span>
                        <span
                          css={css`
                            font-size: 12px;
                            color: ${colors.muted};
                            margin-left: 6px;
                          `}
                        >
                          {stat}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* Follow Button and Newsletter Subscription - customizable */}
              {(() => {
                const buttonsOrder = user.buttonsOrder || ['follow', 'newsletter']
                const buttonsVisibility = user.buttonsVisibility || { follow: false, newsletter: true }
                const visibleButtons = buttonsOrder.filter(btn => buttonsVisibility[btn] !== false)

                if (visibleButtons.length === 0) return null

                return (
                  <div css={css`margin-top: 16px; display: flex; flex-direction: column; gap: 10px;`}>
                    {visibleButtons.map((btn) => {
                      if (btn === 'follow') {
                        return mounted ? (
                          <FollowButton
                            key="follow"
                            targetUserId={user.id}
                            targetUsername={user.name}
                            targetDisplayName={user.displayName}
                            currentUserId={currentUser?.uid}
                            initialIsFollowing={isFollowing}
                            colors={colors}
                          />
                        ) : null
                      }
                      if (btn === 'newsletter') {
                        return (
                          <SubscribeNewsletter
                            key="newsletter"
                            authorUsername={user.name}
                            authorDisplayName={user.displayName}
                            colors={colors}
                          />
                        )
                      }
                      return null
                    })}
                  </div>
                )
              })()}

              {/* Render sections based on sectionOrder */}
              {(user.sectionOrder || ['skills', 'writing', 'custom']).map((sectionType) => {
                // Skills/Tags Section
                if (sectionType === 'skills' && hasSkills) {
                  return (
                    <div key="skills">
                      {user.dividersVisibility?.skills !== false && (
                        <hr css={css`opacity: 0.15; margin-top: 20px; margin-bottom: 32px; border-color: ${colors.text};`} />
                      )}
                      {user.dividersVisibility?.skills === false && (
                        <div css={css`margin-top: 32px;`} />
                      )}
                      <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                        {user.skillsSectionTitle || 'What I work with'}
                      </p>
                      <div css={css`max-width: 100%; line-height: 30px; word-wrap: break-word; word-break: break-word; margin-top: 16px;`}>
                        {user.skills.map((skill, index) => (
                          <span
                            key={index}
                            css={css`
                              cursor: default;
                              transition: 0.5s ease-in-out;
                              font-size: 14px;
                              color: ${colors.muted};
                              border-radius: 4px;
                              padding: 2px 8px;
                              margin-bottom: 10px;
                              margin-right: 8px;
                              border: 1px solid ${colors.border};
                              display: inline-block;

                              &:hover {
                                color: ${colors.hoverText};
                              }
                            `}
                          >
                            <ColorDot color={getSkillColor(index)} />
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                }

                // Writing Section
                if (sectionType === 'writing' && user.posts.length > 0) {
                  return (
                    <div key="writing">
                      {user.dividersVisibility?.writing !== false && (
                        <hr css={css`opacity: 0.15; margin-top: 20px; margin-bottom: 32px; border-color: ${colors.text};`} />
                      )}
                      {user.dividersVisibility?.writing === false && (
                        <div css={css`margin-top: 32px;`} />
                      )}
                      <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                        Writing
                      </p>
                      <div css={css`display: flex; flex-direction: column; gap: 20px; margin-top: 16px;`}>
                        {user.posts.map((post) => (
                          <Link key={post.id} href={user.isCustomDomain ? `/${post.slug}` : `/${user.name}/${post.slug}`}>
                            <a
                              css={css`
                                cursor: pointer;
                                text-decoration: none;
                                display: block;
                                transition: 0.3s ease-in-out;

                                &:hover {
                                  opacity: 0.7;
                                }
                              `}
                            >
                              {/* Title with dot */}
                              <p css={css`
                                font-weight: 500;
                                color: ${colors.text};
                                margin-bottom: 4px;
                                font-size: 14px;
                                font-family: '${sanitizeFontFamily(user.fontSettings?.headingFont, 'Inter')}', -apple-system, BlinkMacSystemFont, sans-serif;
                              `}>
                                <ColorDot color={getPostColor(post)} />
                                {post.title ? htmlToText(post.title) : 'Untitled'}
                              </p>
                              {/* Excerpt and date */}
                              <p css={css`
                                font-size: 13px;
                                color: ${colors.muted};
                                line-height: 1.5;
                                font-family: '${sanitizeFontFamily(user.fontSettings?.bodyFont, 'Inter')}', Georgia, serif;
                              `}>
                                {(() => {
                                  // Check if excerpt has actual content (not just whitespace/empty)
                                  const excerptText = post.excerpt ? htmlToText(post.excerpt).trim() : ''
                                  const text = excerptText || htmlToText(post.content).trim()
                                  // Limit to reasonable length for preview
                                  if (!text) return ''
                                  return text.length > 150 ? text.substring(0, 150) + '...' : text
                                })()}
                                {' '}
                                <span css={css`opacity: 0.7;`}>
                                  // {formatShortDate(post.lastEdited)}
                                </span>
                              </p>
                            </a>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                }

                // Custom Sections
                if (sectionType === 'custom' && hasCustomSections) {
                  // Width mapping for blank sections
                  const getWidthStyle = (width) => {
                    switch (width) {
                      case 'small': return '25%'
                      case 'medium': return '50%'
                      case 'large': return '75%'
                      case 'full': return '100%'
                      default: return '50%'
                    }
                  }

                  return (
                    <div key="custom">
                      {user.customSections.map((section, index) => (
                        <div key={index}>
                          {user.dividersVisibility?.custom !== false && (
                            <hr css={css`opacity: 0.15; margin-top: 20px; margin-bottom: 32px; border-color: ${colors.text};`} />
                          )}
                          {user.dividersVisibility?.custom === false && (
                            <div css={css`margin-top: 32px;`} />
                          )}
                          {section.type === 'blank' ? (
                            <div
                              css={css`
                                width: ${getWidthStyle(section.width)};
                                min-height: 100px;
                              `}
                              data-blank-section="true"
                              data-section-index={index}
                            />
                          ) : (
                            <>
                              <p css={css`font-weight: 500; margin-bottom: 8px;`}>
                                {section.title}
                              </p>
                              <p css={css`color: ${colors.muted}; a { color: inherit; }; margin-top: 16px;`}>
                                {section.content}
                              </p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                }

                return null
              })}

              {/* Footer - exactly like berrysauce */}
              <div css={css`font-size: 12px; margin-top: 64px;`}>
                <p css={css`color: ${colors.muted}; a { color: inherit; }`}>
                  Copyright &copy; {currentYear} Bublr<br />
                  {/* Show custom footer text, "Made with Bublr" default, or nothing if empty string */}
                  {user.customBranding?.footerText ? (
                    <>
                      <span>{user.customBranding.footerText}</span>
                      &nbsp;&middot;&nbsp;
                    </>
                  ) : user.customBranding?.footerText === '' ? (
                    // Empty string = hide branding entirely
                    null
                  ) : (
                    // No customBranding set = show default
                    <>
                      <a href="https://bublr.life" target="_blank" rel="noreferrer">Made with Bublr</a>
                      &nbsp;&middot;&nbsp;
                    </>
                  )}
                  <a href="https://bublr.life/terms" target="_blank" rel="noreferrer">Terms</a>
                  &nbsp;&middot;&nbsp;
                  <a href="https://bublr.life/privacy" target="_blank" rel="noreferrer">Privacy</a>
                </p>
                {/* Theme toggle button - like berrysauce's High Contrast button */}
                {mounted && (
                  <button
                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    css={css`
                      font-size: 14px;
                      font-family: Inter, sans-serif;
                      color: ${colors.muted};
                      border-radius: 4px;
                      padding: 2px 8px;
                      margin-top: -36px;
                      border: 1px solid ${colors.border};
                      background-color: transparent;
                      float: right;
                      cursor: pointer;
                      transition: all 0.3s ease;

                      &:hover {
                        color: ${colors.text};
                        border-color: ${colors.text};
                      }
                    `}
                  >
                    {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
      </ProfileCanvas>

      {/* Organization schema - critical for E-E-A-T */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify(organizationSchema)
      }} />

      {/* ProfilePage structured data with E-E-A-T signals */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify(profilePageSchema)
      }} />
    </>
  )
}

export async function getServerSideProps({ params, req }) {
  const { username } = params
  const host = req.headers.host || ''
  const hostWithoutPort = host.split(':')[0]

  // Check if this is a custom domain request
  // List of main domains that should NOT be treated as custom domains
  const mainDomains = ['bublr.life', 'www.bublr.life', 'localhost']
  const isMainDomain = mainDomains.includes(hostWithoutPort)
  const isVercelPreview = host.includes('.vercel.app')

  // If it's a custom domain, the "username" param might actually be a post slug
  if (!isMainDomain && !isVercelPreview) {
    try {
      // Look up which user owns this custom domain
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'
      const lookupRes = await fetch(`${baseUrl}/api/domain/lookup?domain=${encodeURIComponent(host)}`)

      if (lookupRes.ok) {
        const domainData = await lookupRes.json()

        // Check if the "username" param matches a post slug for this user
        const domainUser = await getUserByName(domainData.userName)
        const matchingPost = domainUser.posts.find(p => p.slug === username && p.published)

        if (matchingPost) {
          // This is a post request on a custom domain - redirect to the post page internally
          // We use redirect here because the post page has its own getStaticProps
          return {
            redirect: {
              destination: `/${domainData.userName}/${username}`,
              permanent: false,
            },
          }
        }
      }
    } catch (error) {
      console.error('Custom domain post lookup error:', error)
    }
  }

  try {
    const user = await getUserByName(username)

    // Check if this is being accessed via a custom domain (with grace period support)
    const isCustomDomain = user.customDomain?.domain === hostWithoutPort &&
                           user.customDomain?.status === 'verified' &&
                           hasActiveAccess(user)

    // Add isCustomDomain flag to user for frontend use
    user.isCustomDomain = isCustomDomain

    // Process posts efficiently
    const processedPosts = user.posts
      .filter(p => p.published)
      .map(p => ({
        ...p,
        lastEdited: p.lastEdited?.toDate?.() ? p.lastEdited.toDate().getTime() : p.lastEdited?.toMillis?.() || Date.now(),
      }))
      .sort((a, b) => b.lastEdited - a.lastEdited)
      .slice(0, 20)

    user.posts = processedPosts

    // Ensure socialLinks exists
    if (!user.socialLinks) {
      user.socialLinks = {}
    }

    // Ensure skills exists
    if (!user.skills) {
      user.skills = []
    }

    // Ensure customSections exists
    if (!user.customSections) {
      user.customSections = []
    }

    // Ensure skillsSectionTitle exists
    if (!user.skillsSectionTitle) {
      user.skillsSectionTitle = ''
    }

    // Ensure sectionOrder exists
    if (!user.sectionOrder) {
      user.sectionOrder = ['skills', 'writing', 'custom']
    }

    // Include customBranding if it exists (for premium users)
    if (!user.customBranding) {
      user.customBranding = null
    }

    // Ensure followers and following arrays exist for stats display
    if (!user.followers) {
      user.followers = []
    }

    if (!user.following) {
      user.following = []
    }

    // Ensure subscribers exists (only pass count, not actual emails for privacy)
    if (!user.subscribers) {
      user.subscribers = []
    }

    // Ensure statsVisibility exists
    if (!user.statsVisibility) {
      user.statsVisibility = { followers: false, following: false, subscribers: false }
    }

    // Ensure statsOrder exists
    if (!user.statsOrder) {
      user.statsOrder = ['followers', 'following', 'subscribers']
    }

    // Ensure statsStyle exists
    if (!user.statsStyle) {
      user.statsStyle = 'separator'
    }

    // Ensure statsAlignment exists
    if (!user.statsAlignment) {
      user.statsAlignment = 'center'
    }

    // Ensure buttonsVisibility exists
    if (!user.buttonsVisibility) {
      user.buttonsVisibility = { follow: false, newsletter: true }
    }

    // Ensure buttonsOrder exists
    if (!user.buttonsOrder) {
      user.buttonsOrder = ['follow', 'newsletter']
    }

    // Ensure dividersVisibility exists
    if (!user.dividersVisibility) {
      user.dividersVisibility = { skills: true, writing: true, custom: true }
    }

    // Banner defaults
    if (!user.banner) {
      user.banner = null
    }
    if (!user.bannerPosition) {
      user.bannerPosition = 'center'
    }
    if (!user.bannerStyle) {
      user.bannerStyle = 'rounded'
    }
    if (!user.bannerFade) {
      user.bannerFade = 'subtle'
    }
    if (!user.bannerOverlay) {
      user.bannerOverlay = 'none'
    }

    // Avatar frame defaults
    if (!user.avatarFrame) {
      user.avatarFrame = {
        type: 'none',
        color: null,
        gradientColors: null,
        customUrl: null,
        size: 'medium'
      }
    }

    // Font settings defaults (with sanitization for security)
    if (!user.fontSettings) {
      user.fontSettings = {
        headingFont: 'Inter',
        bodyFont: 'Inter',
        codeFont: 'JetBrains Mono'
      }
    } else {
      // Sanitize existing font settings
      user.fontSettings = {
        headingFont: sanitizeFontFamily(user.fontSettings.headingFont, 'Inter'),
        bodyFont: sanitizeFontFamily(user.fontSettings.bodyFont, 'Inter'),
        codeFont: sanitizeFontFamily(user.fontSettings.codeFont, 'JetBrains Mono')
      }
    }

    // Calculate custom fonts to load (exclude defaults that are globally loaded)
    const defaultFonts = ['Inter', 'Newsreader', 'JetBrains Mono']
    const customFonts = [
      user.fontSettings.headingFont,
      user.fontSettings.bodyFont,
      user.fontSettings.codeFont
    ]
      .filter(f => f && !defaultFonts.includes(f))
      .filter((f, i, arr) => arr.indexOf(f) === i) // Remove duplicates

    // Profile decorations defaults
    if (!user.profileDecorations) {
      user.profileDecorations = {
        enabled: false,
        updatedAt: null,
        items: []
      }
    }

    // Generate schemas server-side for SSR compatibility
    const organizationSchema = generateOrganizationSchema()
    const profilePageSchema = generateProfilePageSchema({
      name: user.displayName,
      username: user.name,
      photo: user.photo,
      about: user.about,
      socialLinks: user.socialLinks,
      website: user.link,
      postCount: user.posts?.length || 0,
      followerCount: user.followers?.length || 0,
      subscriberCount: user.subscribers?.length || 0
    })

    return {
      props: { user, organizationSchema, profilePageSchema, customFonts },
    }
  } catch (err) {
    console.log(err)
    return { notFound: true }
  }
}
