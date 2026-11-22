// Stand-in for the groq-sdk package: returns a scripted moderation verdict,
// or the next queued answer/error (for the Profile HTML AI helper).
export const calls = []
let verdict = { shouldUnpublish: false, reason: '', category: 'none' }
const queue = []

export function setModerationVerdict(next) {
  verdict = next
}

// Queue a reply for the next create() call: a string (the message content)
// or an Error (thrown).
export function queueCompletion(reply) {
  queue.push(reply)
}

export function resetGroq() {
  calls.length = 0
  queue.length = 0
  verdict = { shouldUnpublish: false, reason: '', category: 'none' }
}

export default class Groq {
  constructor(options) {
    this.options = options
    this.chat = {
      completions: {
        create: async params => {
          calls.push(params)
          if (queue.length) {
            const reply = queue.shift()
            if (reply instanceof Error) throw reply
            return { choices: [{ message: { content: reply } }] }
          }
          return { choices: [{ message: { content: JSON.stringify(verdict) } }] }
        },
      },
    }
  }
}
