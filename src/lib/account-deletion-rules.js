// What deleting an account asks of the writer. Shared by the browser (the
// Delete account form) and the server (/api/account/delete), so it lives
// apart from lib/delete-account, which pulls in server-only code.

export const DELETE_CONFIRM_PHRASE = 'delete my account'

// How recently the caller must have signed in. Deleting everything is not
// something a token left open in an old tab should be able to do.
export const RECENT_SIGN_IN_SECONDS = 10 * 60
