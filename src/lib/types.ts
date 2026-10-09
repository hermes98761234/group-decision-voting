export interface Poll {
  title: string
  options: string[]
}

/** One voter's ballot (or `count` identical voters). Option indexes refer to Poll.options. */
export interface Ballot {
  id: string
  /** Full strict ranking, best first. */
  ranking: number[]
  /** Score 0..MAX_SCORE per option (indexed by option), never rising down the ranking. */
  scores: number[]
  count: number
}

export const MAX_SCORE = 5
/** A voter approves every option they scored at least this much. */
export const APPROVAL_MIN = 3
export const MAX_OPTIONS = 12
export const KEMENY_MAX = 8

export type MethodId =
  | 'plurality'
  | 'borda'
  | 'irv'
  | 'condorcet'
  | 'copeland'
  | 'schulze'
  | 'rankedPairs'
  | 'approval'
  | 'star'
  | 'kemeny'

export interface MethodResult {
  id: MethodId
  /** null only for the pure Condorcet rule when the majorities form a cycle. */
  winner: number | null
  /** Options sharing first place before the deterministic tie-break (length 1 = no tie). */
  tied: number[]
  /** Best first; ties broken in favour of the option listed first in the poll. */
  order: number[]
  /** Per-option number behind the ranking, described by scoreLabel. */
  scores: number[]
  scoreLabel: string
}
