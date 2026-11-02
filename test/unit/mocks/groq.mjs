// Stand-in for the groq-sdk package: returns a scripted moderation verdict.
export const calls = []
let verdict = { shouldUnpublish: false, reason: '', category: 'none' }

export function setModerationVerdict(next) {
  verdict = next
}

export function resetGroq() {
  calls.length = 0
  verdict = { shouldUnpublish: false, reason: '', category: 'none' }
}

export default class Groq {
  constructor(options) {
    this.options = options
    this.chat = {
      completions: {
        create: async params => {
          calls.push(params)
          return { choices: [{ message: { content: JSON.stringify(verdict) } }] }
        },
      },
    }
  }
}
