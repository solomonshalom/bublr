// Removed next-sitemap dependency due to compatibility issues
import { firestore } from '../lib/firebase'

export const getServerSideProps = async ({ res }) => {
  res.setHeader('Content-Type', 'application/xml')
  
  try {
    // Get all published posts
    const postsSnapshot = await firestore.collection('posts')
      .where('published', '==', true)
      .get()
    
    // Get all users (to map author IDs to usernames)
    const usersSnapshot = await firestore.collection('users').get()
    const users = {}
    usersSnapshot.forEach(doc => {
      const data = doc.data()
      users[doc.id] = data.name
    })
    
    // Start XML sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    
    // Add post URLs
    postsSnapshot.forEach(doc => {
      const post = doc.data()
      const username = users[post.author]
      
      if (username && post.slug) {
        const lastmod = post.lastEdited ? new Date(post.lastEdited.toDate()).toISOString() : new Date().toISOString()
        
        xml += '  <url>\n'
        xml += `    <loc>https://bublr.life/${username}/${post.slug}</loc>\n`
        xml += `    <lastmod>${lastmod}</lastmod>\n`
        xml += '    <changefreq>monthly</changefreq>\n'
        xml += '    <priority>0.8</priority>\n'
        xml += '  </url>\n'
      }
    })
    
    // Add user profile URLs
    usersSnapshot.forEach(doc => {
      const user = doc.data()
      
      if (user.name) {
        xml += '  <url>\n'
        xml += `    <loc>https://bublr.life/${user.name}</loc>\n`
        xml += '    <changefreq>weekly</changefreq>\n'
        xml += '    <priority>0.7</priority>\n'
        xml += '  </url>\n'
      }
    })
    
    // Add homepage
    xml += '  <url>\n'
    xml += '    <loc>https://bublr.life</loc>\n'
    xml += '    <changefreq>daily</changefreq>\n'
    xml += '    <priority>1.0</priority>\n'
    xml += '  </url>\n'
    
    // Close XML
    xml += '</urlset>'
    
    // Send XML response
    res.write(xml)
    res.end()
    
    return { props: {} }
  } catch (error) {
    console.error('Error generating sitemap:', error)
    res.statusCode = 500
    res.write('Error generating sitemap')
    res.end()
    
    return { props: {} }
  }
}

// Default export to prevent next.js errors
export default function Sitemap() {}