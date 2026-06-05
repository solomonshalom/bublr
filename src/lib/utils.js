// Add this to your lib/utils.js or create a new file
export const generateSearchQueries = (post) => {
  const queries = [];
  
  // Add title words
  if (post.title) {
    const titleWords = post.title
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2); // ignore words shorter than 3 chars
    queries.push(...titleWords);
  }
  
  // Add excerpt words
  if (post.excerpt) {
    const excerptWords = post.excerpt
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
    queries.push(...excerptWords);
  }
  
  // Add content words (first 100 words to avoid too many tokens)
  if (post.content) {
    const contentText = post.content
      .replace(/<[^>]*>/g, '') // remove HTML tags
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 100); // limit to first 100 words
    queries.push(...contentText);
  }
  
  // Remove duplicates and return
  return [...new Set(queries)];
};

export function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' }
  return new Date(date).toLocaleDateString('en-US', options)
}

export function truncate(str, length) {
  if (!str || str.length <= length) return str
  return str.slice(0, length) + '...'
}

/**
 * Uploads an image or video to Cloudinary using a server-generated signature.
 * The API secret never reaches the browser — /api/cloudinary-sign signs the
 * request server-side and returns only a short-lived signature.
 * @param {File} file The image/video file to upload
 * @returns {Promise<string|null>} The secure HTTPS URL, or null on failure
 */
export async function uploadToCloudinary(file) {
  if (!file) return null;

  try {
    const signRes = await fetch('/api/cloudinary-sign', { method: 'POST' });
    if (!signRes.ok) {
      console.error('Failed to obtain Cloudinary signature');
      return null;
    }

    const { signature, timestamp, apiKey, cloudName, folder } = await signRes.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    if (folder) formData.append('folder', folder);

    // 'auto' lets Cloudinary detect image vs video from the file itself.
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: 'POST', body: formData }
    );

    const data = await response.json();

    if (data.secure_url) {
      return data.secure_url;
    } else {
      console.error('Error uploading to Cloudinary:', data.error || data);
      return null;
    }
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return null;
  }
}