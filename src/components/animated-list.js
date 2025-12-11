/** @jsxImportSource @emotion/react */
import { motion, AnimatePresence } from 'framer-motion'
import { listVariants, itemVariants } from '../lib/animation-config'

export function AnimatedList({ children, className, style }) {
  return (
    <motion.ul
      variants={listVariants}
      initial="hidden"
      animate="visible"
      className={className}
      style={style}
    >
      {children}
    </motion.ul>
  )
}

export function AnimatedListItem({ children, itemKey, ...props }) {
  return (
    <motion.li variants={itemVariants} {...props}>
      {children}
    </motion.li>
  )
}

// For exit animations when items are removed
export function AnimatedListWithExit({ children, className, style }) {
  return (
    <motion.ul className={className} style={style}>
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </motion.ul>
  )
}

export function AnimatedListItemWithExit({ children, itemKey, ...props }) {
  return (
    <motion.li
      key={itemKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
      {...props}
    >
      {children}
    </motion.li>
  )
}
