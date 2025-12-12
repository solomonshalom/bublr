/** @jsxImportSource @emotion/react */
import { motion } from 'framer-motion'
import { loadingContainerVariants, prefersReducedMotion } from '../lib/animation-config'

/**
 * LoadingContainer - Replaces skeleton loaders with subtle opacity transition
 * Shows children at 30% opacity during loading, fades to 100% when loaded
 */
export function LoadingContainer({
  isLoading,
  children,
  className,
  style,
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

  return (
    <MotionComponent
      variants={loadingContainerVariants}
      initial="loading"
      animate={isLoading ? 'loading' : 'loaded'}
      className={className}
      style={style}
    >
      {children}
    </MotionComponent>
  )
}

export default LoadingContainer
