/** @jsxImportSource @emotion/react */
import { motion } from 'framer-motion'
import { prefersReducedMotion, PREMIUM_EASING, DURATION } from '../lib/animation-config'

/**
 * FadeIn - Simple fade-in wrapper with optional direction
 * Great for hero sections, headings, and content that should animate on mount
 */
export function FadeIn({
  children,
  className,
  style,
  direction = 'up', // 'up', 'down', 'left', 'right', 'none'
  delay = 0,
  duration = DURATION.slow,
  distance = 20,
  as = 'div'
}) {
  const MotionComponent = motion[as] || motion.div

  // Skip animation if user prefers reduced motion
  if (prefersReducedMotion()) {
    return (
      <MotionComponent className={className} style={style}>
        {children}
      </MotionComponent>
    )
  }

  // Calculate initial position based on direction
  const getInitialPosition = () => {
    switch (direction) {
      case 'up': return { y: distance }
      case 'down': return { y: -distance }
      case 'left': return { x: distance }
      case 'right': return { x: -distance }
      case 'none': return {}
      default: return { y: distance }
    }
  }

  return (
    <MotionComponent
      initial={{
        opacity: 0,
        ...getInitialPosition()
      }}
      animate={{
        opacity: 1,
        x: 0,
        y: 0,
      }}
      transition={{
        duration,
        delay,
        ease: PREMIUM_EASING
      }}
      className={className}
      style={style}
    >
      {children}
    </MotionComponent>
  )
}

/**
 * FadeInGroup - Container for staggered fade-in animations
 */
export function FadeInGroup({
  children,
  className,
  style,
  staggerDelay = 0.08,
  delayChildren = 0,
  as = 'div'
}) {
  const MotionComponent = motion[as] || motion.div

  if (prefersReducedMotion()) {
    return (
      <MotionComponent className={className} style={style}>
        {children}
      </MotionComponent>
    )
  }

  return (
    <MotionComponent
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren
          },
        },
      }}
      className={className}
      style={style}
    >
      {children}
    </MotionComponent>
  )
}

/**
 * FadeInItem - Child item for FadeInGroup
 */
export function FadeInItem({
  children,
  className,
  style,
  direction = 'up',
  distance = 15,
  as = 'div'
}) {
  const MotionComponent = motion[as] || motion.div

  if (prefersReducedMotion()) {
    return (
      <MotionComponent className={className} style={style}>
        {children}
      </MotionComponent>
    )
  }

  const getInitialPosition = () => {
    switch (direction) {
      case 'up': return { y: distance }
      case 'down': return { y: -distance }
      case 'left': return { x: distance }
      case 'right': return { x: -distance }
      case 'none': return {}
      default: return { y: distance }
    }
  }

  return (
    <MotionComponent
      variants={{
        hidden: { opacity: 0, ...getInitialPosition() },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          transition: { duration: 0.4, ease: PREMIUM_EASING }
        },
      }}
      className={className}
      style={style}
    >
      {children}
    </MotionComponent>
  )
}

export default FadeIn
