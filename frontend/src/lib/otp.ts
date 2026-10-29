/** Fixed-length code string; empty slots are spaces. */
export function emptyCode(length = 6) {
  return ' '.repeat(length)
}

export function isCompleteCode(value: string, length = 6) {
  return new RegExp(`^\\d{${length}}$`).test(value)
}
