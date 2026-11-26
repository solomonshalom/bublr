// Newsletter subscribers are stored as { email, subscribedAt } (older lists
// may hold plain strings). Sign-ups made while email is configured start as
// { pending: true } and only count once the reader confirms from their inbox.
// Anything without the flag, including every older subscriber, is confirmed.

export const isPending = sub => !!sub && typeof sub === 'object' && sub.pending === true

// A paid subscriber who unsubscribed while their payment couldn't be stopped
// stays on the list, marked, so the writer can still cancel it from Bublr.
// They get no email.
export const isUnsubscribed = sub => !!sub && typeof sub === 'object' && sub.unsubscribed === true

export const confirmedSubscribers = list => (Array.isArray(list) ? list : []).filter(s => !isPending(s) && !isUnsubscribed(s))

export const subscriberEmail = sub => String((typeof sub === 'string' ? sub : sub?.email) || '').toLowerCase()
