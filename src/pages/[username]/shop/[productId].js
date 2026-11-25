import ProductPage from '../../../components/blocks/product-page'
import { loadProductPageProps } from '../../../lib/shop-page'

export default ProductPage

export async function getServerSideProps({ params, res }) {
  try {
    const props = await loadProductPageProps({ username: params.username, productId: params.productId })
    if (!props) return { notFound: true }
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
    return { props }
  } catch (error) {
    console.error('Product page failed:', error)
    return { notFound: true }
  }
}
