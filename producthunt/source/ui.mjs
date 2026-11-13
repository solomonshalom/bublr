// Small drawn pieces for the slides. The app screens themselves are not drawn
// here any more: they are real captures in ./shots (see README).
// What is left is the one thing the app has no screen for, the list of files
// inside an export, plus Bublr's dot colours.

export const DOTS = { purple: '#cf52f2', green: '#6BCB77', blue: '#4D96FF', violet: '#A66CFF', red: '#E23E57', orange: '#ff3e00' }

// the dot the profile page draws next to each post
export const dot = (c, size = 10) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M7 3.34a10 10 0 1 1 -4.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 4.995 -8.336z" fill="${c}"/></svg>`

const ICON = {
  file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`,
  folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  braces: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/></svg>`,
  archive: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>`,
}

// Drawn with the app's own light tokens (src/pages/_app.js) and Inter.
export const ZIP_CSS = `
.zip{--grey-1:#fcfcfc;--grey-3:#6f6f6f;--grey-4:#2e2e2e;--grey-5:#171717;--border:rgb(222,223,223);--muted:#f6f6f6;--border-dashed:rgba(0,0,0,.16);
  font-family:'Inter',sans-serif;font-size:16px;line-height:1.5;letter-spacing:0;font-weight:400;color:var(--grey-4);-webkit-font-smoothing:antialiased;
  background:var(--grey-1);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.zip *{box-sizing:border-box}
.zip svg{display:block;flex-shrink:0}
.zip-h{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--muted);border-bottom:1px dashed var(--border-dashed)}
.zip-h .zi{width:36px;height:36px;border-radius:8px;border:1px solid var(--border);border-bottom-width:2px;background:var(--grey-1);display:flex;align-items:center;justify-content:center;color:var(--grey-4)}
.zip-h .zn{font-size:13.6px;font-weight:500;color:var(--grey-5);line-height:1.4}
.zip-h .zm{font-size:11.5px;color:var(--grey-3);line-height:1.4}
.zip-b{padding:8px 8px 10px}
.zr{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;font-size:13.2px;color:var(--grey-4);line-height:1.4;white-space:nowrap}
.zr svg{color:var(--grey-3)}
.zr.in{padding-left:36px}
.zr.more{color:var(--grey-3);font-size:12px}
`

// What "Download export" hands you. `files` is the real listing of a real
// export (shots/meta.json → exportFiles), in the order the .zip stores it.
export function zipCard({ filename, files, counts, show = 4 }) {
  const posts = files.filter(f => f.includes('/posts/')).map(f => f.split('/').pop())
  const rest = posts.length - show
  return `<div class="zip">
  <div class="zip-h"><span class="zi">${ICON.archive}</span><div><p class="zn">${filename}</p><p class="zm">${counts.posts} posts and drafts · Markdown + JSON</p></div></div>
  <div class="zip-b">
    <div class="zr">${ICON.file}README.md</div>
    <div class="zr">${ICON.folder}posts</div>
    ${posts.slice(0, show).map(n => `<div class="zr in">${ICON.file}${n}</div>`).join('')}
    ${rest > 0 ? `<div class="zr in more">and ${rest} more</div>` : ''}
    <div class="zr">${ICON.braces}bublr-export.json</div>
  </div></div>`
}
