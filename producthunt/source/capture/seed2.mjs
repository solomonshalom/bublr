// Second half of the demo data, written straight into the emulator.
import fs from 'fs'
import { getDoc, patchDoc, setDoc } from './lib.mjs'

const state = JSON.parse(fs.readFileSync('state.json', 'utf8'))
const { uid, ids } = state
const D = s => new Date(s)
const DOT = { purple: '#cf52f2', green: '#6BCB77', blue: '#4D96FF', violet: '#A66CFF', red: '#E23E57', orange: '#ff3e00' }
const p = (...paras) => paras.map(t => `<p>${t}</p>`).join('')

// the post Juniper wrote in the editor: publish it, give it a slug and a dot
await patchDoc('posts/' + ids.words, {
  published: true, slug: 'writing-300-words-a-day-for-a-year', dotColor: DOT.purple,
  lastEdited: D('2026-11-09T08:12:00Z'), views: 1283, likes: 86,
})
// her three drafts, most recent first
await patchDoc('posts/' + ids.sunday, { lastEdited: D('2026-11-13T07:40:00Z'), shareToken: '9f2c41e07ab35d86c0e4b7a1d2f3905c6e8a4b17d0c3f2e9' })
await patchDoc('posts/' + ids.walk, { lastEdited: D('2026-11-12T18:05:00Z') })
await patchDoc('posts/' + ids.notebooks, { lastEdited: D('2026-11-11T21:30:00Z') })

// the rest of her published writing
const more = [
  ['leaving-the-group-chat', 'Leaving the group chat', 'A month without it, and what I did with the time.', DOT.red, '2026-11-02T09:00:00Z'],
  ['my-grandmothers-recipe-cards', "My grandmother's recipe cards", 'Every one of them is a first draft with notes in the margin.', DOT.orange, '2026-10-24T09:00:00Z'],
  ['a-bench-by-the-river', 'A bench by the river', 'Twenty minutes, most evenings, doing nothing in particular.', DOT.green, '2026-10-17T09:00:00Z'],
  ['learning-to-like-mornings', 'Learning to like mornings', 'It took a kettle, a window and six months.', DOT.blue, '2026-10-03T09:00:00Z'],
  ['small-towns-long-walks', 'Small towns, long walks', 'Notes from a week with no signal.', DOT.violet, '2026-09-21T09:00:00Z'],
]
const juniperPosts = [ids.sunday, ids.notebooks, ids.walk, ids.words]
for (const [slug, title, excerpt, dotColor, when] of more) {
  const id = 'demo-' + slug
  await setDoc('posts/' + id, { title, excerpt, slug, dotColor, author: uid, published: true, lastEdited: D(when), content: p(excerpt, 'More soon.') })
  juniperPosts.push(id)
}

// a sticker on her profile (the same shape ProfileCanvas saves)
await patchDoc('users/' + uid, {
  posts: juniperPosts,
  profileDecorations: {
    enabled: true, updatedAt: Date.now(),
    items: [{
      id: 'demo-starry-night', type: 'url', src: '/demo/sticker-starry-night.png',
      x: 76, y: 12, width: 150, height: 150, rotation: 8, flipX: false, flipY: false, zIndex: 1, opacity: 1, createdAt: Date.now(),
    }],
  },
})

// three other writers, so Explore has more than one voice
const others = [
  ['theo', 'theo', 'Fixes bikes, writes about it.', 'the-quiet-joy-of-fixing-old-bikes', 'The quiet joy of fixing old bikes', 'A garage, a pile of rusty frames and a slower way to spend Saturdays.', '2026-11-08T10:00:00Z'],
  ['priya', 'Priya R.', 'Learning out loud.', 'learning-japanese-at-40', 'Learning Japanese at 40', 'Kanji flashcards, small wins and why I stopped counting streaks.', '2026-11-07T10:00:00Z'],
  ['oluwadamilare', 'oluwadamilare', 'Letters, mostly.', 'letters-i-never-sent', 'Letters I never sent', 'Ten years of drafts, finally out of the drawer.', '2026-11-06T10:00:00Z'],
]
for (const [name, displayName, about, slug, title, excerpt, when] of others) {
  const id = 'demo-' + slug
  await setDoc('posts/' + id, { title, excerpt, slug, author: 'demo-' + name, published: true, lastEdited: D(when), content: p(excerpt) })
  await setDoc('users/demo-' + name, { name, displayName, about, email: null, photo: `/demo/${name}.png`, posts: [id], readingList: [] })
}
console.log('seeded', JSON.stringify(await getDoc('users/' + uid)).slice(0, 200))
