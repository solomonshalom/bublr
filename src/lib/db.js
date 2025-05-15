import firebase, { firestore } from './firebase'

// Simple memory cache for database operations
const cache = {
  users: new Map(),
  posts: new Map(),
  userByName: new Map(),
  ttl: 5 * 60 * 1000, // 5 minutes cache TTL
  timestamps: new Map(),
};

// Helper function to check if cache entry is valid
const isCacheValid = (key, mapName) => {
  if (!cache.timestamps.has(`${mapName}:${key}`)) return false;
  const timestamp = cache.timestamps.get(`${mapName}:${key}`);
  return Date.now() - timestamp < cache.ttl;
};

// Helper function to set cache with timestamp
const setCache = (key, value, mapName) => {
  cache[mapName].set(key, value);
  cache.timestamps.set(`${mapName}:${key}`, Date.now());
  return value;
};

// Function to get all users with published posts for sitemap generation
export async function getAllUsersWithPublishedPosts() {
  // This operation is less frequent, so we'll use a simple caching approach
  const cacheKey = 'all_users_with_published_posts';
  
  if (cache.users.has(cacheKey) && isCacheValid(cacheKey, 'users')) {
    return cache.users.get(cacheKey);
  }
  
  // Ensure firestore is available (client-side)
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    // Wait for dynamic import to resolve if needed
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) {
      throw new Error('Firestore initialization failed');
    }
  }
  
  const usersSnapshot = await firestore.collection('users').get();
  const users = [];
  
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    if (userData.posts && userData.posts.length > 0) {
      // Use a batch get for better performance
      const postRefs = userData.posts.map(postId => 
        firestore.collection('posts').doc(postId)
      );
      
      // Split into chunks of 10 to avoid exceeding Firestore limits
      const chunks = [];
      for (let i = 0; i < postRefs.length; i += 10) {
        chunks.push(postRefs.slice(i, i + 10));
      }
      
      let allPostDocs = [];
      for (const chunk of chunks) {
        const batchResults = await firestore.getAll(...chunk);
        allPostDocs = [...allPostDocs, ...batchResults];
      }
      
      // Filter to only published posts and extract necessary data
      const publishedPosts = allPostDocs
        .filter(postDoc => postDoc.exists && postDoc.data().published)
        .map(postDoc => {
          const postData = postDoc.data();
          // Add to post cache while we're here
          setCache(postDoc.id, { id: postDoc.id, ...postData }, 'posts');
          
          return {
            id: postDoc.id,
            slug: postData.slug,
            lastEdited: postData.lastEdited,
            title: postData.title
          };
        });
      
      // Only include users who have at least one published post
      if (publishedPosts.length > 0) {
        users.push({
          id: userDoc.id,
          name: userData.name,
          photo: userData.photo,
          displayName: userData.displayName,
          posts: publishedPosts
        });
        
        // Add to user cache while we're here
        setCache(userDoc.id, { id: userDoc.id, ...userData }, 'users');
        if (userData.name) {
          setCache(userData.name, { id: userDoc.id, ...userData }, 'userByName');
        }
      }
    }
  }
  
  return setCache(cacheKey, users, 'users');
}

export async function userWithIDExists(id) {
  // Check cache first
  if (cache.users.has(id) && isCacheValid(id, 'users')) {
    return true;
  }
  
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  const doc = await firestore.collection('users').doc(id).get();
  if (doc.exists) {
    // Cache the user data while we have it
    setCache(id, { id: doc.id, ...doc.data() }, 'users');
  }
  return doc.exists;
}

export async function userWithNameExists(name) {
  // Check cache first
  if (cache.userByName.has(name) && isCacheValid(name, 'userByName')) {
    return true;
  }
  
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  const query = await firestore
    .collection('users')
    .where('name', '==', name)
    .limit(1)
    .get();

  if (!query.empty) {
    const userData = query.docs[0].data();
    // Cache the user data while we have it
    setCache(query.docs[0].id, { id: query.docs[0].id, ...userData }, 'users');
    setCache(name, { id: query.docs[0].id, ...userData }, 'userByName');
  }
  
  return !query.empty;
}

export async function getUserByID(id) {
  // Check cache first
  if (cache.users.has(id) && isCacheValid(id, 'users')) {
    const cachedUser = cache.users.get(id);
    // Only if the cached user has complete post data
    if (cachedUser.posts && Array.isArray(cachedUser.posts) && 
        cachedUser.posts.length > 0 && typeof cachedUser.posts[0] === 'object') {
      return cachedUser;
    }
  }
  
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  const doc = await firestore.collection('users').doc(id).get();
  if (!doc.exists) {
    throw { code: 'user/not-found' };
  }

  const user = doc.data();
  
  // Batch fetch posts for performance
  if (user.posts && user.posts.length > 0) {
    // Use a batch approach for better performance
    const chunkedPostIds = [];
    for (let i = 0; i < user.posts.length; i += 10) {
      chunkedPostIds.push(user.posts.slice(i, i + 10));
    }
    
    let allPosts = [];
    for (const chunk of chunkedPostIds) {
      const postPromises = chunk.map(postId => getPostByID(postId));
      const posts = await Promise.all(postPromises);
      allPosts = [...allPosts, ...posts];
    }
    user.posts = allPosts;
  } else {
    user.posts = [];
  }

  const result = { id: doc.id, ...user };
  return setCache(id, result, 'users');
}

export async function getUserByName(name) {
  // Check cache first
  if (cache.userByName.has(name) && isCacheValid(name, 'userByName')) {
    const cachedUser = cache.userByName.get(name);
    // Only if the cached user has complete post data
    if (cachedUser.posts && Array.isArray(cachedUser.posts) && 
        cachedUser.posts.length > 0 && typeof cachedUser.posts[0] === 'object') {
      return cachedUser;
    }
  }
  
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  const query = await firestore
    .collection('users')
    .where('name', '==', name)
    .limit(1)
    .get();

  if (query.empty || !query.docs[0].exists) {
    throw { code: 'user/not-found' };
  }

  const userData = query.docs[0].data();
  const userId = query.docs[0].id;
  
  // Batch fetch posts for performance
  let userPosts = [];
  if (userData.posts && userData.posts.length > 0) {
    // Use a batch approach for better performance
    const chunkedPostIds = [];
    for (let i = 0; i < userData.posts.length; i += 10) {
      chunkedPostIds.push(userData.posts.slice(i, i + 10));
    }
    
    for (const chunk of chunkedPostIds) {
      const postPromises = chunk.map(postId => getPostByID(postId));
      const posts = await Promise.all(postPromises);
      userPosts = [...userPosts, ...posts];
    }
  }
  
  const user = { id: userId, ...userData, posts: userPosts };
  
  // Cache the result under both ID and name
  setCache(userId, user, 'users');
  return setCache(name, user, 'userByName');
}

export async function getPostByID(id) {
  // Check cache first
  if (cache.posts.has(id) && isCacheValid(id, 'posts')) {
    return cache.posts.get(id);
  }
  
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  const doc = await firestore.collection('posts').doc(id).get();
  if (!doc.exists) {
    throw { code: 'post/not-found' };
  }

  return setCache(id, { id: doc.id, ...doc.data() }, 'posts');
}

export async function removePostForUser(uid, pid) {
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  try {
    // Use a batch to ensure atomicity
    const batch = firestore.batch();
    
    // Delete post document
    const postRef = firestore.collection('posts').doc(pid);
    batch.delete(postRef);
    
    // Update user document to remove post reference
    const userRef = firestore.collection('users').doc(uid);
    batch.update(userRef, { 
      posts: firebase.firestore.FieldValue.arrayRemove(pid) 
    });
    
    await batch.commit();
    
    // Update cache
    cache.posts.delete(pid);
    if (cache.users.has(uid)) {
      const userData = cache.users.get(uid);
      if (userData.posts) {
        userData.posts = userData.posts.filter(post => 
          typeof post === 'string' ? post !== pid : post.id !== pid
        );
        setCache(uid, userData, 'users');
      }
    }
    
    // Also update userByName cache if we have a matching entry
    for (const [userName, userData] of cache.userByName.entries()) {
      if (userData.id === uid) {
        if (userData.posts) {
          userData.posts = userData.posts.filter(post => 
            typeof post === 'string' ? post !== pid : post.id !== pid
          );
          setCache(userName, userData, 'userByName');
        }
      }
    }
  } catch (error) {
    console.error('Error removing post:', error);
    throw error;
  }
}

export async function postWithIDExists(id) {
  // Check cache first
  if (cache.posts.has(id) && isCacheValid(id, 'posts')) {
    return true;
  }
  
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  const doc = await firestore.collection('posts').doc(id).get();
  if (doc.exists) {
    // Cache the post data while we have it
    setCache(id, { id: doc.id, ...doc.data() }, 'posts');
  }
  return doc.exists;
}

export async function postWithUsernameAndSlugExists(username, slug) {
  // Check cache first for the user
  let user;
  if (cache.userByName.has(username) && isCacheValid(username, 'userByName')) {
    user = cache.userByName.get(username);
    // Check if we have complete post objects with slug info
    if (user.posts && Array.isArray(user.posts) && user.posts.length > 0 && 
        typeof user.posts[0] === 'object' && user.posts[0].slug) {
      const post = user.posts.find(post => post.slug === slug);
      if (post) return post;
    }
  }
  
  // If not in cache or no complete post objects, fetch from DB
  user = await getUserByName(username);
  return user.posts.find(post => post.slug === slug);
}

export async function postWithUserIDAndSlugExists(uid, slug) {
  // Check cache first for the user
  let user;
  if (cache.users.has(uid) && isCacheValid(uid, 'users')) {
    user = cache.users.get(uid);
    // Check if we have complete post objects with slug info
    if (user.posts && Array.isArray(user.posts) && user.posts.length > 0 && 
        typeof user.posts[0] === 'object' && user.posts[0].slug) {
      const post = user.posts.find(post => post.slug === slug);
      if (post) return post;
    }
  }
  
  // If not in cache or no complete post objects, fetch from DB
  user = await getUserByID(uid);
  return user.posts.find(post => post.slug === slug);
}

export async function getPostByUsernameAndSlug(username, slug) {
  const user = await getUserByName(username);
  const post = user.posts.find(post => post.slug === slug);
  if (!post) {
    throw { code: 'post/not-found' };
  }

  return post;
}

export async function setUser(id, data) {
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  await firestore.collection('users').doc(id).set(data);
  
  // Update cache
  if (data.name) {
    setCache(data.name, { id, ...data }, 'userByName');
  }
  setCache(id, { id, ...data }, 'users');
}

export async function setPost(id, data) {
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  await firestore.collection('posts').doc(id).set(data);
  
  // Update post cache
  setCache(id, { id, ...data }, 'posts');
  
  // Update user caches if we have the author's data cached
  if (data.author) {
    if (cache.users.has(data.author)) {
      const userData = cache.users.get(data.author);
      // Update the post in the user's posts array if it exists
      if (userData.posts && Array.isArray(userData.posts)) {
        const postIndex = userData.posts.findIndex(post => 
          typeof post === 'string' ? post === id : post.id === id
        );
        
        if (postIndex >= 0) {
          // Replace the post with updated data
          userData.posts[postIndex] = { id, ...data };
        } else {
          // Add the post if it doesn't exist
          userData.posts.push({ id, ...data });
        }
        
        setCache(data.author, userData, 'users');
      }
    }
    
    // Also update in userByName cache if we have a matching entry
    for (const [userName, userData] of cache.userByName.entries()) {
      if (userData.id === data.author) {
        if (userData.posts && Array.isArray(userData.posts)) {
          const postIndex = userData.posts.findIndex(post => 
            typeof post === 'string' ? post === id : post.id === id
          );
          
          if (postIndex >= 0) {
            userData.posts[postIndex] = { id, ...data };
          } else {
            userData.posts.push({ id, ...data });
          }
          
          setCache(userName, userData, 'userByName');
        }
      }
    }
  }
}

export async function createPostForUser(userId) {
  // Ensure firestore is available
  if (!firestore) {
    if (typeof window === 'undefined') {
      throw new Error('Firestore is not available on server-side without explicit initialization');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!firestore) throw new Error('Firestore initialization failed');
  }
  
  try {
    // Create post with a single Firestore operation for efficiency
    const batch = firestore.batch();
    
    const postRef = firestore.collection('posts').doc();
    const postId = postRef.id;
    
    const postData = {
      title: '',
      excerpt: '',
      content: '',
      author: userId,
      published: false,
      slug: postId,
      lastEdited: firebase.firestore.Timestamp.now(),
    };
    
    batch.set(postRef, postData);
    
    const userRef = firestore.collection('users').doc(userId);
    batch.update(userRef, { 
      posts: firebase.firestore.FieldValue.arrayUnion(postId) 
    });
    
    await batch.commit();
    
    // Update cache
    setCache(postId, { id: postId, ...postData }, 'posts');
    
    // Update user cache if user exists in cache
    if (cache.users.has(userId)) {
      const userData = cache.users.get(userId);
      if (!userData.posts) {
        userData.posts = [];
      }
      
      if (Array.isArray(userData.posts)) {
        userData.posts.push(postId);
        setCache(userId, userData, 'users');
      }
    }
    
    return postId;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
}
