import { skipNextPageTransition } from '../page-transition'
import { supportsViewTransition } from './tokens'

/**
 * Client-side navigation inside a view transition, so a shop photo and title
 * glide from the grid into the product page and back (the reference site does
 * this with cross-document view transitions; Next's router needs it wrapped).
 *
 * Falls back to a normal router.push where view transitions aren't supported.
 */
export function navigateWithTransition(router, href, { as, scrollToId } = {}) {
  if (!supportsViewTransition()) {
    return router.push(href, as).then(() => {
      if (scrollToId) scrollToElement(scrollToId)
    })
  }

  const root = document.documentElement
  root.classList.add('shop-vt')
  skipNextPageTransition()

  let settled = false
  const transition = document.startViewTransition(
    () =>
      new Promise(resolve => {
        const done = () => {
          if (settled) return
          settled = true
          router.events.off('routeChangeComplete', done)
          router.events.off('routeChangeError', done)
          requestAnimationFrame(() => {
            if (scrollToId) scrollToElement(scrollToId)
            resolve()
          })
        }
        router.events.on('routeChangeComplete', done)
        router.events.on('routeChangeError', done)
        router.push(href, as).catch(done)
      })
  )
  transition.finished.finally(() => root.classList.remove('shop-vt'))
  return transition.finished.catch(() => {})
}

function scrollToElement(id) {
  const element = document.getElementById(id)
  if (!element) return
  const top = element.getBoundingClientRect().top + window.scrollY - 24
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
}

/** onClick for links that should navigate with a view transition. */
export function transitionClick(router, href, options) {
  return event => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigateWithTransition(router, href, options)
  }
}
