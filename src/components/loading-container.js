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

  // Reduced motion: same element, with the fade made instant. (Rendering a
  // plain element instead could leave the server's 30% opacity in place after
  // hydration.)
  const reduced = prefersReducedMotion()

  return (
    <MotionComponent
      variants={
        reduced
          ? { ...loadingContainerVariants, loaded: { ...loadingContainerVariants.loaded, transition: { duration: 0 } } }
          : loadingContainerVariants
      }
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
