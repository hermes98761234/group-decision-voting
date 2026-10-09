import { approves } from './ballots'
import { KEMENY_MAX, type Ballot, type MethodId, type MethodResult } from './types'

/** Indexes sorted by score (high first); equal scores keep poll order. This is the library-wide tie-break. */
export function rankOrder(scores: readonly number[]): number[] {
  return scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b)
}

function fromScores(id: MethodId, scores: number[], scoreLabel: string): MethodResult {
  const order = rankOrder(scores)
  const max = scores[order[0]]
  return { id, winner: order[0], tied: order.filter((i) => scores[i] === max).sort((a, b) => a - b), order, scores, scoreLabel }
}

export function plurality(n: number, ballots: readonly Ballot[]): MethodResult {
  const s = new Array<number>(n).fill(0)
  for (const b of ballots) s[b.ranking[0]] += b.count
  return fromScores('plurality', s, 'first-place votes')
}

export function borda(n: number, ballots: readonly Ballot[]): MethodResult {
  const s = new Array<number>(n).fill(0)
  for (const b of ballots) b.ranking.forEach((o, pos) => (s[o] += (n - 1 - pos) * b.count))
  return fromScores('borda', s, 'Borda points')
}

export function approval(n: number, ballots: readonly Ballot[]): MethodResult {
  const s = new Array<number>(n).fill(0)
  for (const b of ballots) for (let o = 0; o < n; o++) if (approves(b.scores[o])) s[o] += b.count
  return fromScores('approval', s, 'approvals')
}

/** Head-to-head wins of each option (a tie counts half). */
export function copelandScores(p: number[][]): number[] {
  const n = p.length
  return p.map((row, i) => {
    let s = 0
    for (let j = 0; j < n; j++) if (j !== i) s += row[j] > p[j][i] ? 1 : row[j] === p[j][i] ? 0.5 : 0
    return s
  })
}

export function copeland(p: number[][]): MethodResult {
  return fromScores('copeland', copelandScores(p), 'pairwise wins')
}

export interface Analysis {
  condorcetWinner: number | null
  condorcetLoser: number | null
  /** Smallest group that beats everyone outside it (top cycle); size > 1 means a Condorcet paradox. */
  smith: number[]
  /** Strict majority edges [winner, loser, margin]. */
  edges: [number, number, number][]
}

export function analyze(p: number[][]): Analysis {
  const n = p.length
  const beats = (i: number, j: number) => p[i][j] > p[j][i]
  const edges: [number, number, number][] = []
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && beats(i, j)) edges.push([i, j, p[i][j] - p[j][i]])
  const all = [...Array(n).keys()]
  const cw = all.filter((i) => all.every((j) => j === i || beats(i, j)))
  const cl = all.filter((i) => all.every((j) => j === i || beats(j, i)))
  // Top cycle: options that reach every other option through "wins or ties" steps.
  const reach = (from: number) => {
    const seen = new Set([from])
    const stack = [from]
    while (stack.length) {
      const x = stack.pop()!
      for (const y of all) if (!seen.has(y) && p[x][y] >= p[y][x]) {
          seen.add(y)
          stack.push(y)
        }
    }
    return seen.size === n
  }
  return { condorcetWinner: cw[0] ?? null, condorcetLoser: cl[0] ?? null, smith: all.filter(reach), edges }
}

export function condorcet(p: number[][], a: Analysis): MethodResult {
  const base = copeland(p)
  const w = a.condorcetWinner
  return { ...base, id: 'condorcet', winner: w, tied: w === null ? [] : [w] }
}

export type SchulzeResult = MethodResult & { paths: number[][] }

export function schulze(p: number[][]): SchulzeResult {
  const n = p.length
  const s = p.map((row, i) => row.map((v, j) => (i !== j && v > p[j][i] ? v : 0)))
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++) {
      if (i === k) continue
      for (let j = 0; j < n; j++) if (j !== i && j !== k) s[i][j] = Math.max(s[i][j], Math.min(s[i][k], s[k][j]))
    }
  const beaten = (i: number, j: number) => s[i][j] > s[j][i]
  const scores = s.map((_, i) => s.filter((_, j) => j !== i && beaten(i, j)).length)
  const base = fromScores('schulze', scores, 'options beaten')
  const unbeaten = scores.map((_, i) => i).filter((i) => scores.every((_, j) => j === i || !beaten(j, i)))
  return { ...base, tied: unbeaten, winner: unbeaten[0], paths: s }
}

export type RankedPairsResult = MethodResult & {
  locked: [number, number, number][]
  skipped: [number, number, number][]
  /** Adjacent pairs with identical winning votes and margin, ordered by poll position. */
  tieBreaks: number
}

/** Winners under every rotation of the arbitrary tie-break: more than one means the result hinged on it. */
export function rankedPairs(p: number[][]): RankedPairsResult {
  const base = rankedPairsCore(p, 0)
  const tied = new Set(base.tied)
  for (let shift = 1; shift < p.length; shift++) rankedPairsCore(p, shift).tied.forEach((i) => tied.add(i))
  return { ...base, tied: [...tied].sort((a, b) => a - b) }
}

function rankedPairsCore(p: number[][], shift: number): RankedPairsResult {
  const n = p.length
  const rot = (i: number) => (i + shift) % n
  const pairs: { w: number; l: number; margin: number; votes: number }[] = []
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) if (p[i][j] > p[j][i]) pairs.push({ w: i, l: j, margin: p[i][j] - p[j][i], votes: p[i][j] })
  pairs.sort((a, b) => b.votes - a.votes || b.margin - a.margin || rot(a.w) - rot(b.w) || rot(a.l) - rot(b.l))
  let tieBreaks = 0
  for (let k = 1; k < pairs.length; k++) if (pairs[k].margin === pairs[k - 1].margin && pairs[k].votes === pairs[k - 1].votes) tieBreaks++

  const out = Array.from({ length: n }, () => [] as number[])
  const reaches = (from: number, to: number): boolean => {
    const seen = new Set([from])
    const stack = [from]
    while (stack.length) {
      const x = stack.pop()!
      if (x === to) return true
      for (const y of out[x]) {
        if (seen.has(y)) continue
        seen.add(y)
        stack.push(y)
      }
    }
    return false
  }
  const locked: [number, number, number][] = []
  const skipped: [number, number, number][] = []
  for (const { w, l, margin } of pairs) {
    if (reaches(l, w)) skipped.push([w, l, margin])
    else {
      out[w].push(l)
      locked.push([w, l, margin])
    }
  }
  // Order = topological order of the locked graph, smallest poll index first among equals.
  const incoming = new Array<number>(n).fill(0)
  for (const [, l] of locked) incoming[l]++
  const tied = incoming.map((c, i) => (c === 0 ? i : -1)).filter((i) => i >= 0)
  const order: number[] = []
  const left = new Set(incoming.keys())
  while (left.size) {
    const next = [...left].filter((i) => incoming[i] === 0).sort((a, b) => a - b)[0]
    left.delete(next)
    order.push(next)
    for (const l of out[next]) incoming[l]--
  }
  const scores = out.map((o) => o.length)
  return { id: 'rankedPairs', winner: order[0], tied, order, scores, scoreLabel: 'locked wins', locked, skipped, tieBreaks }
}

export interface IrvRound {
  counts: number[]
  active: boolean[]
  eliminated: number | null
  /** Options tied for fewest votes when eliminating (empty if no tie). */
  tie: number[]
}
export type IrvResult = MethodResult & { rounds: IrvRound[] }

/** Winners under every rotation of the elimination tie-break: more than one means the result hinged on it. */
export function irv(n: number, ballots: readonly Ballot[]): IrvResult {
  const base = irvCore(n, ballots, 0)
  const tied = new Set([base.winner!])
  for (let shift = 1; shift < n; shift++) tied.add(irvCore(n, ballots, shift).winner!)
  return { ...base, tied: [...tied].sort((a, b) => a - b) }
}

function irvCore(n: number, ballots: readonly Ballot[], shift: number): IrvResult {
  const active = new Array<boolean>(n).fill(true)
  const rounds: IrvRound[] = []
  const eliminatedOrder: number[] = []
  for (;;) {
    const counts = new Array<number>(n).fill(0)
    for (const b of ballots) counts[b.ranking.find((o) => active[o])!] += b.count
    const live = [...active.keys()].filter((i) => active[i])
    const total = live.reduce((s, i) => s + counts[i], 0)
    const max = Math.max(...live.map((i) => counts[i]))
    if (live.length === 1 || max * 2 > total) {
      rounds.push({ counts, active: [...active], eliminated: null, tie: [] })
      break
    }
    const min = Math.min(...live.map((i) => counts[i]))
    const lows = live.filter((i) => counts[i] === min)
    const out = lows.reduce((a, b) => ((b + shift) % n > (a + shift) % n ? b : a)) // tie: the option listed later goes out
    rounds.push({ counts, active: [...active], eliminated: out, tie: lows.length > 1 ? lows : [] })
    active[out] = false
    eliminatedOrder.push(out)
  }
  const last = rounds[rounds.length - 1]
  const live = [...active.keys()].filter((i) => active[i]).sort((a, b) => last.counts[b] - last.counts[a] || a - b)
  const order = [...live, ...eliminatedOrder.reverse()]
  const scores = new Array<number>(n).fill(0)
  for (const r of rounds) r.active.forEach((a, i) => a && (scores[i] = r.counts[i]))
  return { id: 'irv', winner: order[0], tied: [order[0]], order, scores, scoreLabel: 'votes in last round', rounds }
}

export type StarResult = MethodResult & { finalists: [number, number]; runoff: [number, number] }

export function star(n: number, ballots: readonly Ballot[]): StarResult {
  const totals = new Array<number>(n).fill(0)
  for (const b of ballots) for (let o = 0; o < n; o++) totals[o] += b.scores[o] * b.count
  const order = rankOrder(totals)
  const [a, b] = order
  let ra = 0
  let rb = 0
  for (const x of ballots) {
    if (x.scores[a] > x.scores[b]) ra += x.count
    else if (x.scores[b] > x.scores[a]) rb += x.count
  }
  // Runoff by preference; a dead heat falls back to total score, then poll order (a is already ahead on both).
  const winner = rb > ra ? b : a
  const tied = ra === rb && totals[a] === totals[b] ? [a, b] : [winner]
  const rest = order.filter((i) => i !== winner)
  return { id: 'star', winner, tied, order: [winner, ...rest], scores: totals, scoreLabel: 'total score', finalists: [a, b], runoff: [ra, rb] }
}

export type KemenyResult = MethodResult & { kemenyScore: number; optimalRankings: number }

/** Exhaustive search for the ranking agreeing with the most pairwise votes. Null above KEMENY_MAX options. */
export function kemeny(p: number[][]): KemenyResult | null {
  const n = p.length
  if (n > KEMENY_MAX) return null
  let best = -1
  let bestRank: number[] = []
  let firsts = new Set<number>()
  let optimal = 0
  const used = new Array<boolean>(n).fill(false)
  const cur: number[] = []
  const dfs = (score: number) => {
    if (cur.length === n) {
      if (score > best) {
        best = score
        bestRank = [...cur]
        firsts = new Set([cur[0]])
        optimal = 1
      } else if (score === best) {
        optimal++
        firsts.add(cur[0])
      }
      return
    }
    for (let c = 0; c < n; c++) {
      if (used[c]) continue
      let add = 0
      for (const q of cur) add += p[q][c]
      used[c] = true
      cur.push(c)
      dfs(score + add)
      cur.pop()
      used[c] = false
    }
  }
  dfs(0)
  const scores = bestRank.map((o, pos) => bestRank.slice(pos + 1).reduce((s, x) => s + p[o][x], 0))
  const byOption = new Array<number>(n).fill(0)
  bestRank.forEach((o, pos) => (byOption[o] = scores[pos]))
  return { id: 'kemeny', winner: bestRank[0], tied: [...firsts].sort((a, b) => a - b), order: bestRank, scores: byOption, scoreLabel: 'votes backing its place', kemenyScore: best, optimalRankings: optimal }
}
