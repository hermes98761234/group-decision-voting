import { isPermutation, makeBallot, validatePoll } from './ballots'
import { MAX_OPTIONS, MAX_SCORE, type Ballot, type Poll } from './types'

const VERSION = 1

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64(text: string): Uint8Array {
  const s = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** 16-bit fingerprint of the poll, so a ballot cannot be pasted into the wrong poll by accident. */
export function pollHash(poll: Poll): number {
  let h = 0x811c9dc5
  for (const byte of new TextEncoder().encode(JSON.stringify([poll.title.trim(), ...poll.options.map((o) => o.trim())]))) {
    h = Math.imul(h ^ byte, 0x01000193) >>> 0
  }
  return (h ^ (h >>> 16)) & 0xffff
}

export function newBallotId(): string {
  const b = crypto.getRandomValues(new Uint8Array(3))
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** Layout: [version<<4 | n] [ranking nibbles] [score nibbles by option] [poll hash x2] [id x3]. */
export function encodeBallot(ballot: Ballot, poll: Poll): string {
  const n = poll.options.length
  const nibbles = [...ballot.ranking, ...ballot.scores]
  if (nibbles.length % 2) nibbles.push(0)
  const bytes = [(VERSION << 4) | n]
  for (let i = 0; i < nibbles.length; i += 2) bytes.push((nibbles[i] << 4) | nibbles[i + 1])
  const h = pollHash(poll)
  bytes.push(h >> 8, h & 0xff)
  for (let i = 0; i < 3; i++) bytes.push(parseInt(ballot.id.slice(i * 2, i * 2 + 2), 16))
  return toB64(Uint8Array.from(bytes))
}

export function decodeBallot(code: string, poll: Poll): Ballot {
  let bytes: Uint8Array
  try {
    bytes = fromB64(code.trim())
  } catch {
    throw new Error('not a ballot code')
  }
  const n = poll.options.length
  if (bytes.length < 1 || bytes[0] >> 4 !== VERSION) throw new Error('not a ballot code')
  if ((bytes[0] & 15) !== n) throw new Error('belongs to a poll with a different number of options')
  const nib = n // 2n nibbles
  if (bytes.length !== 1 + nib + 5) throw new Error('not a ballot code')
  const nibbles: number[] = []
  for (let i = 0; i < nib; i++) nibbles.push(bytes[1 + i] >> 4, bytes[1 + i] & 15)
  const ranking = nibbles.slice(0, n)
  const scores = nibbles.slice(n, 2 * n)
  const tail = bytes.slice(1 + nib)
  if (((tail[0] << 8) | tail[1]) !== pollHash(poll)) throw new Error('belongs to a different poll')
  if (!isPermutation(ranking, n) || scores.some((s) => s > MAX_SCORE)) throw new Error('damaged ballot code')
  const id = [...tail.slice(2)].map((x) => x.toString(16).padStart(2, '0')).join('')
  return makeBallot(id, ranking, 1, scores)
}

/** Pulls ballot codes out of pasted text: bare codes or links containing `b=CODE`. */
export function extractCodes(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((tok) => tok.match(/[#&?]b=([A-Za-z0-9_-]+)/)?.[1] ?? tok)
}

export function encodePoll(poll: Poll): string {
  return toB64(new TextEncoder().encode(JSON.stringify([poll.title, ...poll.options])))
}

export function decodePoll(text: string): Poll | null {
  try {
    const arr: unknown = JSON.parse(new TextDecoder().decode(fromB64(text)))
    if (!Array.isArray(arr) || arr.length < 3 || arr.length > MAX_OPTIONS + 1 || !arr.every((x) => typeof x === 'string')) return null
    const poll = { title: arr[0] as string, options: (arr as string[]).slice(1) }
    return validatePoll(poll) ? null : poll
  } catch {
    return null
  }
}
