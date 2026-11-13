// One-paragraph version of the published post (see the note in README about
// the newsletter email running paragraphs together).
import fs from 'fs'
import { patchDoc } from './lib.mjs'
const { ids } = JSON.parse(fs.readFileSync('state.json', 'utf8'))
await patchDoc('posts/' + ids.words, {
  content: '<p>In January I promised myself 300 words a day. Not good words, just words. Some days they were a grocery list with feelings. Some days they were the best thing I wrote all year. I never knew which until I sat down.</p>',
})
console.log('ok')
