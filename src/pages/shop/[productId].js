import ProductPage from '../../components/blocks/product-page'
import { loadProductPageProps } from '../../lib/shop-page'

/**
 * A product on a writer's custom domain (<domain>/shop/<id>). On bublr.life
 * itself products live at /<username>/shop/<id>, so this answers 404 there.
 */
export default ProductPage

const MAIN_HOSTS = ['bublr.life', 'www.bublr.life', 'localhost']

export async function getServerSideProps({ params, req, res }) {
  const host = String(req.headers.host || '')
  const hostname = host.split(':')[0].toLowerCase()
  if (MAIN_HOSTS.includes(hostname) || hostname.endsWith('.vercel.app')) return { notFound: true }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bublr.life'
    const lookup = await fetch(`${baseUrl}/api/domain/lookup?domain=${encodeURIComponent(hostname)}`)
    if (!lookup.ok) return { notFound: true }
    const { userName } = await lookup.json()
    const props = await loadProductPageProps({ username: userName, productId: params.productId, onCustomDomain: true })
    if (!props) return { notFound: true }
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
    return { props }
  } catch (error) {
    console.error('Custom-domain product page failed:', error)
    return { notFound: true }
  }
}
