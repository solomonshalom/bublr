# ImgBB Image Upload Integration

This project now includes direct image uploading to ImgBB when adding images to posts.

## Environment Variables Setup

1. Get an API key from [ImgBB](https://api.imgbb.com/)
2. Add your API key to the `.env.local` file:
   ```
   NEXT_PUBLIC_IMGBB_API=your_imgbb_api_key
   ```
3. Restart the development server after adding the key

The application securely uses this environment variable for all API requests instead of hardcoding any keys in the source code.

## Usage

When editing a post, click the "+ Image" button to open a file selector. The selected image will be automatically uploaded to ImgBB and inserted into the post content.