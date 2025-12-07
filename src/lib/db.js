import firebase, { firestore } from './firebase'

// Function to get all users with published posts for sitemap generation
export async function getAllUsersWithPublishedPosts() {
  const usersSnapshot = await firestore.collection('users').get()
  const users = []
  
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data()
    if (userData.posts && userData.posts.length > 0) {
      // Get all posts for this user
      const postDocs = await Promise.all(
        userData.posts.map(postId => firestore.collection('posts').doc(postId).get())
      )
      
      // Filter to only published posts and extract necessary data
      const publishedPosts = postDocs
        .filter(postDoc => postDoc.exists && postDoc.data().published)
        .map(postDoc => {
          const postData = postDoc.data()
          return {
            id: postDoc.id,
            slug: postData.slug,
            lastEdited: postData.lastEdited,
            title: postData.title // Include title for better SEO
          }
        })
      
      // Only include users who have at least one published post
      if (publishedPosts.length > 0) {
        users.push({
          id: userDoc.id,
          name: userData.name,
          photo: userData.photo, // Include photo for image sitemap
          displayName: userData.displayName, // Include displayName for better titles
          posts: publishedPosts
        })
      }
    }
  }
  
  return users
}

export const createPostWithSearch = async (postData) => {
  const searchQueries = generateSearchQueries(postData);
  
  const postWithSearch = {
    ...postData,
    searchQueries,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  const docRef = await firestore.collection('posts').add(postWithSearch);
  return docRef.id;
};

export const updatePostWithSearch = async (postId, postData) => {
  const searchQueries = generateSearchQueries(postData);
  
  const updateData = {
    ...postData,
    searchQueries,
    updatedAt: Date.now(),
  };
  
  await firestore.collection('posts').doc(postId).update(updateData);
};

export const generateSearchQueries = (postData) => {
  // Extract text from title and content
  const title = postData.title || '';
  const content = postData.content || '';
  const excerpt = postData.excerpt || '';
  
  // Combine all text for tokenization
  const fullText = `${title} ${excerpt} ${content}`.toLowerCase();
  
  // Tokenize and filter for unique terms
  const terms = fullText
    .replace(/[^\w\s]/g, '') // Remove special chars
    .split(/\s+/) // Split by whitespace
    .filter(term => term.length > 2) // Only terms with 3+ chars
    .filter((term, i, arr) => arr.indexOf(term) === i); // Unique terms
  
  // Generate phonetic variants and common prefixes for fuzzy matching
  const fuzzyTerms = [];
  terms.forEach(term => {
    // Add the original term
    fuzzyTerms.push(term);
    
    // Add term prefixes for partial matching (if term length > 4)
    if (term.length > 4) {
      // Add prefixes of different lengths (minimum 3 chars)
      for (let i = 3; i < term.length; i++) {
        fuzzyTerms.push(term.substring(0, i));
      }
    }
    
    // Add common misspelling patterns
    // Double letter to single letter
    if (/(.)\1/.test(term)) {
      fuzzyTerms.push(term.replace(/(.)\1+/g, '$1'));
    }
    
    // Single letter to double letter for common doubled letters
    ['l', 'r', 's', 't', 'p', 'n', 'm'].forEach(letter => {
      if (term.includes(letter)) {
        fuzzyTerms.push(term.replace(letter, letter + letter));
      }
    });
    
    // Common vowel substitutions
    if (term.includes('a')) fuzzyTerms.push(term.replace(/a/g, 'e'));
    if (term.includes('e')) fuzzyTerms.push(term.replace(/e/g, 'a'));
    if (term.includes('i')) fuzzyTerms.push(term.replace(/i/g, 'y'));
  });
  
  // Filter again for uniqueness and limit to 30 terms
  return [...new Set(fuzzyTerms)].slice(0, 30); // Firebase limit is 30 values in array-contains-any
};

export const searchPosts = async (searchInput, limit = 20) => {
  if (!searchInput || searchInput.trim() === '') {
    // Return recent published posts if no search term
    const snapshot = await firestore
      .collection('posts')
      .where('published', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  
  const originalInput = searchInput.trim();
  
  // Process search input
  const searchTerms = searchInput
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(term => term.length > 2);
  
  if (searchTerms.length === 0) {
    // If no valid search terms after processing, return recent posts
    const snapshot = await firestore
      .collection('posts')
      .where('published', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  
  try {
    // Collect all posts to apply client-side fuzzy search
    const allPublishedSnapshot = await firestore
      .collection('posts')
      .where('published', '==', true)
      .limit(limit * 2) // Get more posts to ensure we have enough after filtering
      .get();
    
    let allPosts = allPublishedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Apply fuzzy search with scoring
    const scoredPosts = allPosts.map(post => {
      let score = 0;
      const postTitle = post.title ? post.title.toLowerCase() : '';
      const postContent = post.content ? post.content.toLowerCase() : '';
      const postExcerpt = post.excerpt ? post.excerpt.toLowerCase() : '';
      
      // Exact title match gets highest score
      if (postTitle === originalInput.toLowerCase()) {
        score += 100;
      }
      
      // Title contains full search query
      if (postTitle.includes(originalInput.toLowerCase())) {
        score += 75;
      }
      
      // Check for individual terms in title (highest priority)
      for (const term of searchTerms) {
        if (postTitle.includes(term)) {
          score += 50;
        }
        
        // Partial matching in title
        if (term.length > 3) {
          const partialMatchScore = calculatePartialMatchScore(postTitle, term);
          score += partialMatchScore * 20; // Higher weight for title matches
        }
      }
      
      // Check for terms in excerpt
      for (const term of searchTerms) {
        if (postExcerpt.includes(term)) {
          score += 30;
        }
        
        // Partial matching in excerpt
        if (term.length > 3) {
          const partialMatchScore = calculatePartialMatchScore(postExcerpt, term);
          score += partialMatchScore * 10;
        }
      }
      
      // Check for terms in content
      for (const term of searchTerms) {
        if (postContent.includes(term)) {
          score += 20;
        }
        
        // Partial matching in content
        if (term.length > 3) {
          const partialMatchScore = calculatePartialMatchScore(postContent, term);
          score += partialMatchScore * 5;
        }
      }
      
      // Use searchQueries if available (for backward compatibility)
      if (post.searchQueries && Array.isArray(post.searchQueries)) {
        for (const term of searchTerms) {
          if (post.searchQueries.includes(term)) {
            score += 15;
          }
        }
      }
      
      return { ...post, _score: score };
    });
    
    // Filter out posts with zero score
    const matchedPosts = scoredPosts.filter(post => post._score > 0);
    
    // Sort by score (descending)
    matchedPosts.sort((a, b) => b._score - a._score);
    
    // Return top results up to limit
    return matchedPosts
      .slice(0, limit)
      .map(({ _score, ...post }) => post);
  } catch (error) {
    console.error('Error searching posts:', error);
    return [];
  }
};

// Helper function to calculate partial match score
function calculatePartialMatchScore(text, term) {
  if (!text || !term) return 0;
  
  // Check for partial matches at word boundaries
  const words = text.split(/\s+/);
  for (const word of words) {
    // Word starts with the term
    if (word.startsWith(term)) return 0.9;
    
    // Term starts with the word
    if (term.startsWith(word) && word.length >= 3) return 0.8;
    
    // Contains at least 70% of the term (for longer terms)
    if (term.length >= 5) {
      const neededChars = Math.ceil(term.length * 0.7);
      for (let i = 0; i <= word.length - neededChars; i++) {
        const subWord = word.substring(i, i + neededChars);
        if (term.includes(subWord)) return 0.7;
      }
    }
  }
  
  // More flexible fuzzy matching for title
  const maxErrors = Math.floor(term.length / 3);
  if (maxErrors >= 1) {
    // Simple Levenshtein distance for fuzzy matching
    for (const word of words) {
      if (word.length >= term.length - maxErrors && 
          word.length <= term.length + maxErrors) {
        if (getEditDistance(word, term) <= maxErrors) {
          return 0.6;
        }
      }
    }
  }
  
  return 0;
}

// Simple Levenshtein distance implementation for fuzzy matching
function getEditDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  // Create a matrix of size (m+1) x (n+1)
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
  
  // Fill the first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}


export async function userWithIDExists(id) {
  const doc = await firestore.collection('users').doc(id).get()
  return doc.exists
}

export async function userWithNameExists(name) {
  const query = await firestore
    .collection('users')
    .where('name', '==', name)
    .get()

  return !query.empty
}

export async function getUserByID(id) {
  const doc = await firestore.collection('users').doc(id).get()
  if (!doc.exists) {
    throw { code: 'user/not-found' }
  }

  const user = doc.data()
  const postDocPromises = user.posts.map(postId => getPostByID(postId))
  user.posts = await Promise.all(postDocPromises)

  return { id: doc.id, ...user }
}

export async function getUserByName(name) {
  const query = await firestore
    .collection('users')
    .where('name', '==', name)
    .get()

  if (query.empty || !query.docs[0].exists) {
    throw { code: 'user/not-found' }
  }

  const user = { id: query.docs[0].id, ...query.docs[0].data() }
  const postDocPromises = user.posts.map(postId => getPostByID(postId))
  user.posts = await Promise.all(postDocPromises)

  return user
}

export async function getPostByID(id) {
  const doc = await firestore.collection('posts').doc(id).get()
  if (!doc.exists) {
    throw { code: 'post/not-found' }
  }

  return { id: doc.id, ...doc.data() }
}

export async function removePostForUser(uid, pid) {
  await firestore.collection('posts').doc(pid).delete()
  firestore
    .collection('users')
    .doc(uid)
    .update({ posts: firebase.firestore.FieldValue.arrayRemove(pid) })
}

export async function postWithIDExists(id) {
  const doc = await firestore.collection('posts').doc(id).get()
  return doc.exists
}

export async function postWithUsernameAndSlugExists(username, slug) {
  const user = await getUserByName(username)
  return user.posts.find(post => post.slug === slug)
}

export async function postWithUserIDAndSlugExists(uid, slug) {
  const user = await getUserByID(uid)
  return user.posts.find(post => post.slug === slug)
}

export async function getPostByUsernameAndSlug(username, slug) {
  const user = await getUserByName(username)
  const post = user.posts.find(post => post.slug === slug)
  if (!post) {
    throw { code: 'post/not-found' }
  }

  return post
}

export async function setUser(id, data) {
  await firestore.collection('users').doc(id).set(data)
}

export async function setPost(id, data) {
  await firestore.collection('posts').doc(id).set(data)
}

export async function createPostForUser(userId) {
  const doc = await firestore.collection('posts').add({
    title: '',
    excerpt: '',
    content: '',
    author: userId,
    published: false,
    lastEdited: firebase.firestore.Timestamp.now(),
  })

  await firestore.collection('posts').doc(doc.id).update({ slug: doc.id })

  await firestore
    .collection('users')
    .doc(userId)
    .update({ posts: firebase.firestore.FieldValue.arrayUnion(doc.id) })

  return doc.id
}