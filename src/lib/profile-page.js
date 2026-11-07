import { firestore } from './firebase'
import { toPublicUser } from './public-user'
import { toMillis } from './timestamps'
import { hasActiveAccess } from './subscription'
import { liveCustomDomain } from './custom-domains'
import { sanitizeFontFamily } from './fonts'
import {
  generateProfilePageSchema,
  generateOrganizationSchema,
  generateBreadcrumbSchema,
  generateNewsletterSchema,
} from './seo-utils'

/**
 * Everything a writer's profile page needs, for bublr.life/<username> and for
 * the writer's own domain alike (so the two never drift apart).
 *
 * @param {object} user  from getUserByName (posts loaded)
 * @param {object} options
 * @param {string|null} options.customDomain  the writer's domain when the
 *   request arrived on it; links then drop the /<username> prefix
 */
export async function buildProfilePageProps(user, { customDomain = null } = {}) {
  // Decided before toPublicUser strips the billing fields
  user.isCustomDomain = Boolean(customDomain)
  user.liveCustomDomain = customDomain || liveCustomDomain(user)

  // Process posts efficiently
  const processedPosts = user.posts
    .filter(p => p.published)
    .map(p => ({
      ...p,
      lastEdited: toMillis(p.lastEdited) || Date.now(),
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

  // Ensure experience (work/education) fields exist and are JSON-serializable
  const normalizeExperience = (list) =>
    (Array.isArray(list) ? list : []).map(e => ({
      title: e?.title || '',
      organization: e?.organization || '',
      url: e?.url || '',
      avatarSource: e?.avatarSource || 'glass',
      startDate: e?.startDate || '',
      endDate: e?.endDate || '',
      current: e?.current || false,
      location: e?.location || '',
      description: e?.description || '',
    }))
  user.workExperience = normalizeExperience(user.workExperience)
  user.education = normalizeExperience(user.education)
  if (!user.workSectionTitle) {
    user.workSectionTitle = ''
  }
  if (!user.educationSectionTitle) {
    user.educationSectionTitle = ''
  }
  if (!user.workStyle) {
    user.workStyle = 'timeline'
  }
  if (!user.educationStyle) {
    user.educationStyle = 'timeline'
  }

  // Ensure sectionOrder exists and includes guestbook
  if (!user.sectionOrder) {
    user.sectionOrder = ['skills', 'writing', 'guestbook', 'custom']
  } else if (!user.sectionOrder.includes('guestbook')) {
    // Add guestbook to existing sectionOrder (for users who had custom order before guestbook feature)
    // Insert after 'writing' if it exists, otherwise at the end before 'custom'
    const writingIndex = user.sectionOrder.indexOf('writing')
    const customIndex = user.sectionOrder.indexOf('custom')
    if (writingIndex !== -1) {
      user.sectionOrder.splice(writingIndex + 1, 0, 'guestbook')
    } else if (customIndex !== -1) {
      user.sectionOrder.splice(customIndex, 0, 'guestbook')
    } else {
      user.sectionOrder.push('guestbook')
    }
  }

  // Guest book defaults
  if (user.guestbookVisibility === undefined) {
    user.guestbookVisibility = true
  }
  if (!user.guestbookSectionTitle) {
    user.guestbookSectionTitle = 'Guest Book'
  }

  // Custom button text defaults (empty string means use default text)
  if (user.newsletterButtonText === undefined) {
    user.newsletterButtonText = ''
  }
  if (user.guestbookButtonText === undefined) {
    user.guestbookButtonText = ''
  }

  // Custom footer text is a Pro feature: once Pro lapses the default returns
  if (!user.customBranding || !hasActiveAccess(user)) {
    user.customBranding = null
  }

  // Ensure followers and following arrays exist for stats display
  if (!user.followers) {
    user.followers = []
  }

  if (!user.following) {
    user.following = []
  }

  // Ensure subscribers exists (only the count reaches the page, see toPublicUser)
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
    user.dividersVisibility = { skills: true, work: true, education: true, writing: true, guestbook: true, custom: true }
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

  // Breadcrumb schema for navigation SEO
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://bublr.life' },
    { name: 'Writers', url: 'https://bublr.life/explore' },
    { name: user.displayName, url: `https://bublr.life/${user.name}` }
  ])

  // Newsletter schema for AI discoverability (only if newsletter is enabled)
  const newsletterSchema = user.buttonsVisibility?.newsletter !== false
    ? generateNewsletterSchema({
        authorName: user.displayName,
        authorUsername: user.name,
        authorPhoto: user.photo,
        authorAbout: user.about,
        subscriberCount: user.subscribers?.length || 0
      })
    : null

  // Fetch guestbook entries if guestbook is enabled
  // Using simple query without composite index to maximize compatibility
  let guestbookEntries = []
  if (user.guestbookVisibility !== false) {
    try {
      // Fetch ALL guestbook entries (no filtering) to avoid needing composite indexes
      const guestbookSnapshot = await firestore
        .collection('users')
        .doc(user.id)
        .collection('guestbook')
        .limit(100)
        .get()

      // Filter and transform in memory
      guestbookEntries = guestbookSnapshot.docs
        .map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name,
            message: data.message || '',
            signaturePath: data.signaturePath,
            signatureViewBox: data.signatureViewBox,
            moderationStatus: data.moderationStatus,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          }
        })
        // Filter for approved entries only
        .filter(entry => entry.moderationStatus === 'approved')
        // Remove moderationStatus from final output (not needed on client)
        .map(({ moderationStatus, ...entry }) => entry)
        // Sort by createdAt descending
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 12)
    } catch (guestbookError) {
      // Continue without guestbook entries - client-side will try to fetch
      console.error('Failed to fetch guestbook entries:', guestbookError.message)
    }
  }

  // Strip private fields (subscriber emails, API keys, billing) last, after
  // the schemas above have used the follower/subscriber counts
  return { user: toPublicUser(user), organizationSchema, profilePageSchema, breadcrumbSchema, newsletterSchema, customFonts, guestbookEntries }
}
