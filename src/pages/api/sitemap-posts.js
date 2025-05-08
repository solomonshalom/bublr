import { firestore } from '../../lib/firebase'

export default async function handler(req, res) {
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
    
    // Build XML
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
    
    xml += '</urlset>'
    
    res.status(200).send(xml)
  } catch (error) {
    console.error('Error generating sitemap:', error)
    res.status(500).send('Error generating sitemap')
  }
}