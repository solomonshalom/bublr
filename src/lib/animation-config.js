// Animation timing standards - fast and responsive
export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
}

// Easing curves (cubic-bezier)
export const EASING = {
  default: [0.4, 0, 0.2, 1],
  enter: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
}

// Stagger delays for list animations
export const STAGGER = {
  fast: 0.03,
  normal: 0.05,
}

// List animation variants
export const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER.fast,
    },
  },
}

export const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.fast,
      ease: EASING.enter,
    },
  },
}

// Panel slide animation
export const panelVariants = {
  hidden: { x: '100%', opacity: 0.5 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: DURATION.normal,
      ease: EASING.enter,
    },
  },
  exit: {
    x: '100%',
    opacity: 0.5,
    transition: {
      duration: DURATION.fast,
      ease: EASING.exit,
    },
  },
}

// Backdrop animation
export const backdropVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.fast },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.fast },
  },
}

// Page transition
export const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.fast },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.instant },
  },
}

// Tab content transition
export const tabContentVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.fast, ease: EASING.default },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: DURATION.instant, ease: EASING.exit },
  },
}

// Check if user prefers reduced motion
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Premium easing curve (smooth and natural)
export const PREMIUM_EASING = [0.25, 0.46, 0.45, 0.94]

// Fade-in-up for hero sections and headings
export const fadeInUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: PREMIUM_EASING },
  },
}

// Stagger container for sequential reveals
export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

// Stagger item (use with staggerContainerVariants)
export const staggerItemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: PREMIUM_EASING },
  },
}

// Scale-fade for cards and interactive elements
export const scaleInVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: EASING.enter },
  },
}

// Loading container fade (replaces skeleton)
export const loadingContainerVariants = {
  loading: { opacity: 0.3 },
  loaded: {
    opacity: 1,
    transition: { duration: 0.4, ease: EASING.default },
  },
}

// Scroll-triggered reveal
export const scrollRevealVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: PREMIUM_EASING },
  },
}

// Enhanced page variants with subtle movement
export const enhancedPageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: PREMIUM_EASING },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2, ease: EASING.exit },
  },
}

// Hover scale for interactive elements
export const hoverScaleVariants = {
  initial: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
}
