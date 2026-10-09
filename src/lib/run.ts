import { pairwise, totalVoters } from './ballots'
import { analyze, approval, borda, condorcet, copeland, irv, kemeny, plurality, rankedPairs, schulze, star } from './methods'
import type { Analysis, IrvResult, KemenyResult, RankedPairsResult, SchulzeResult, StarResult } from './methods'
import type { Ballot, MethodId, MethodResult } from './types'

export const METHOD_ORDER: MethodId[] = ['plurality', 'borda', 'irv', 'condorcet', 'copeland', 'schulze', 'rankedPairs', 'approval', 'star', 'kemeny']

export interface Outcome {
  n: number
  voters: number
  pairwise: number[][]
  analysis: Analysis
  results: Partial<Record<MethodId, MethodResult>>
  irv: IrvResult
  schulze: SchulzeResult
  rankedPairs: RankedPairsResult
  star: StarResult
  kemeny: KemenyResult | null
}

export function runAll(n: number, ballots: readonly Ballot[]): Outcome {
  const p = pairwise(n, ballots)
  const analysis = analyze(p)
  const i = irv(n, ballots)
  const s = schulze(p)
  const rp = rankedPairs(p)
  const st = star(n, ballots)
  const k = kemeny(p)
  const results: Partial<Record<MethodId, MethodResult>> = {
    plurality: plurality(n, ballots),
    borda: borda(n, ballots),
    irv: i,
    condorcet: condorcet(p, analysis),
    copeland: copeland(p),
    schulze: s,
    rankedPairs: rp,
    approval: approval(n, ballots),
    star: st,
  }
  if (k) results.kemeny = k
  return { n, voters: totalVoters(ballots), pairwise: p, analysis, results, irv: i, schulze: s, rankedPairs: rp, star: st, kemeny: k }
}
