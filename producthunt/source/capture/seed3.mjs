// Tidy-ups a writer would do in the app: readable slugs on the drafts, and the
// sticker dragged clear of the bio.
import fs from 'fs'
import { patchDoc, getDoc } from './lib.mjs'
const { uid, ids } = JSON.parse(fs.readFileSync('state.json', 'utf8'))
await patchDoc('posts/' + ids.sunday, { slug: 'notes-from-a-slow-sunday' })
await patchDoc('posts/' + ids.notebooks, { slug: 'the-case-for-boring-notebooks', content: '<p>Fancy notebooks scare me. The paper is too nice to waste on a bad sentence.</p><p>A boring one asks for nothing. So I fill it.</p>' })
await patchDoc('posts/' + ids.walk, { slug: 'things-i-noticed-on-the-walk-home' })
const u = await getDoc('users/' + uid)
const item = { ...u.profileDecorations.items[0], x: 78, y: 8.4, width: 128, height: 128, rotation: 8 }
await patchDoc('users/' + uid, { profileDecorations: { enabled: true, updatedAt: Date.now(), items: [item] } })
console.log('ok')
