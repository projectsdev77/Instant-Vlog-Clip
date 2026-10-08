const KEY = 'ivc-guest-id'

/** Anonymous id so the server can give signed-out users a free trial. */
export function guestId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}
