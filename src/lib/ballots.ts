import { APPROVAL_MIN, MAX_SCORE, type Ballot, type Poll } from './types'

export function isPermutation(a: readonly number[], n: number): boolean {
  if (a.length !== n) return false
  const seen = new Set(a)
  return seen.size === n && a.every((x) => Number.isInteger(x) && x >= 0 && x < n)
}

/** Scores spread evenly from MAX_SCORE (first) down to 0 (last). */
export function defaultScores(ranking: readonly number[]): number[] {
  const n = ranking.length
  const scores = new Array<number>(n).fill(0)
  ranking.forEach((opt, pos) => {
    scores[opt] = n === 1 ? MAX_SCORE : Math.round((MAX_SCORE * (n - 1 - pos)) / (n - 1))
  })
  return scores
}

export function makeBallot(id: string, ranking: number[], count = 1, scores?: number[]): Ballot {
  return { id, ranking: [...ranking], scores: scores ? [...scores] : defaultScores(ranking), count }
}

export function totalVoters(ballots: readonly Ballot[]): number {
  return ballots.reduce((s, b) => s + b.count, 0)
}

export const approves = (score: number) => score >= APPROVAL_MIN

/** p[i][j] = number of voters ranking i above j. */
export function pairwise(n: number, ballots: readonly Ballot[]): number[][] {
  const p = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (const b of ballots) {
    for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) p[b.ranking[a]][b.ranking[c]] += b.count
  }
  return p
}

export function validatePoll(poll: Poll): string | null {
  if (poll.options.length < 2) return 'Add at least two options.'
  const names = poll.options.map((o) => o.trim().toLowerCase())
  if (names.some((n) => n === '')) return 'Every option needs a name.'
  if (new Set(names).size !== names.length) return 'Option names must be different.'
  return null
}
