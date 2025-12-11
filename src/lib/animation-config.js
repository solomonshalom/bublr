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
