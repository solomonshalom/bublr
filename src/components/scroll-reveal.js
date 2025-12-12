/** @jsxImportSource @emotion/react */
import { motion } from 'framer-motion'
import { scrollRevealVariants, prefersReducedMotion, PREMIUM_EASING } from '../lib/animation-config'

/**
 * ScrollReveal - Animates children when they enter the viewport
 * Uses Framer Motion's whileInView for scroll-triggered animations
 */
export function ScrollReveal({
  children,
  className,
  style,
  direction = 'up', // 'up', 'down', 'left', 'right'
  delay = 0,
  duration = 0.6,
  distance = 30,
  once = true, // Only animate once by default
  threshold = 0.1, // Trigger when 10% visible
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
      default: return { y: distance }
    }
  }

  const variants = {
    hidden: {
      opacity: 0,
      ...getInitialPosition()
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration,
        delay,
        ease: PREMIUM_EASING
      },
    },
  }

  return (
    <MotionComponent
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: threshold }}
      className={className}
      style={style}
    >
      {children}
    </MotionComponent>
  )
}

/**
 * ScrollRevealGroup - Container for staggered scroll reveals
 */
export function ScrollRevealGroup({
  children,
  className,
  style,
  staggerDelay = 0.08,
  delayChildren = 0.1,
  once = true,
  threshold = 0.1,
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren
      },
    },
  }

  return (
    <MotionComponent
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: threshold }}
      className={className}
      style={style}
    >
      {children}
    </MotionComponent>
  )
}

/**
 * ScrollRevealItem - Child item for ScrollRevealGroup
 */
export function ScrollRevealItem({
  children,
  className,
  style,
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
      variants={scrollRevealVariants}
      className={className}
      style={style}
    >
      {children}
    </MotionComponent>
  )
}

export default ScrollReveal
