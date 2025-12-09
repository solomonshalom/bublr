const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const https = require('https');

// png-to-ico default export handling
let pngToIco;
try {
  const pngToIcoModule = require('png-to-ico');
  pngToIco = pngToIcoModule.default || pngToIcoModule;
} catch (e) {
  console.warn('png-to-ico not available, will skip favicon.ico generation');
}

// Twemoji URL for bento box emoji (🍱 = U+1F371)
const TWEMOJI_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f371.png';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

/**
 * Download an image from URL
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        downloadImage(response.headers.location).then(resolve).catch(reject);
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Create a PNG with the bento emoji at the specified size using Twemoji
 */
async function createEmojiPng(emojiImage, size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // White background for better visibility
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // Calculate padding (10% on each side)
  const padding = Math.floor(size * 0.1);
  const drawSize = size - (padding * 2);

  // Draw the emoji image centered with padding
  ctx.drawImage(emojiImage, padding, padding, drawSize, drawSize);

  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath} (${size}x${size})`);

  return buffer;
}

/**
 * Create favicon.ico from multiple PNG sizes
 */
async function createFavicon(pngPaths, outputPath) {
  if (!pngToIco) {
    console.warn('Skipping favicon.ico generation (png-to-ico not available)');
    return;
  }
  try {
    const icoBuffer = await pngToIco(pngPaths);
    fs.writeFileSync(outputPath, icoBuffer);
    console.log(`Created: ${outputPath}`);
  } catch (error) {
    console.error('Error creating favicon:', error);
  }
}

async function main() {
  console.log('Generating bento emoji (🍱) logo files...\n');

  // Download the Twemoji bento box image
  console.log('Downloading Twemoji bento box emoji...');
  const imageBuffer = await downloadImage(TWEMOJI_URL);
  const emojiImage = await loadImage(imageBuffer);
  console.log('Downloaded successfully!\n');

  // Generate logo.png (512x512) for PWA and SEO
  await createEmojiPng(emojiImage, 512, path.join(IMAGES_DIR, 'logo.png'));

  // Generate apple-touch-icon.png (180x180)
  await createEmojiPng(emojiImage, 180, path.join(IMAGES_DIR, 'apple-touch-icon.png'));

  // Generate favicon sizes and create .ico
  const sizes = [16, 32, 48];
  const tempPngPaths = [];

  for (const size of sizes) {
    const tempPath = path.join(PUBLIC_DIR, `favicon-${size}.png`);
    await createEmojiPng(emojiImage, size, tempPath);
    tempPngPaths.push(tempPath);
  }

  // Create favicon.ico from the PNGs
  await createFavicon(tempPngPaths, path.join(PUBLIC_DIR, 'favicon.ico'));

  // Clean up temp files (only if favicon was created)
  if (pngToIco) {
    for (const tempPath of tempPngPaths) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        console.log(`Cleaned up: ${tempPath}`);
      }
    }
  } else {
    // Keep one for favicon reference if ico creation failed
    console.log('Temp PNG files kept for manual favicon creation');
  }

  console.log('\nDone! Logo files generated successfully.');
}

main().catch(console.error);
