import { describe, expect, it } from 'vitest'
import { makeBallot, pairwise } from './ballots'
import { PROPERTIES, explain } from './explain'
import { analyze, kemeny, rankedPairs, rankOrder, schulze } from './methods'
import { PRESETS } from './presets'
import { runAll } from './run'
import type { Ballot } from './types'

const tn = PRESETS[0]
const name = (o: ReturnType<typeof runAll>, id: keyof ReturnType<typeof runAll>['results']) => tn.poll.options[o.results[id]!.winner!]

describe('Tennessee capital', () => {
  const o = runAll(4, tn.ballots)
  it('picks a different capital depending on the method', () => {
    expect(name(o, 'plurality')).toBe('Memphis')
    expect(name(o, 'borda')).toBe('Nashville')
    expect(name(o, 'irv')).toBe('Knoxville')
    for (const id of ['condorcet', 'copeland', 'schulze', 'rankedPairs', 'kemeny', 'approval', 'star'] as const) expect(name(o, id)).toBe('Nashville')
  })
  it('has the textbook numbers', () => {
    expect(o.voters).toBe(100)
    expect(o.results.plurality!.scores).toEqual([42, 26, 15, 17])
    expect(o.results.borda!.scores).toEqual([126, 194, 173, 107])
    expect(o.pairwise[1][0]).toBe(58) // Nashville beats Memphis 58-42
    expect(o.analysis.condorcetWinner).toBe(1)
    expect(o.analysis.condorcetLoser).toBe(0) // Memphis loses every pairing
    expect(o.analysis.smith).toEqual([1])
  })
  it('shows the IRV rounds', () => {
    expect(o.irv.rounds.map((r) => r.eliminated)).toEqual([2, 1, null])
    expect(o.irv.rounds[1].counts).toEqual([42, 26, 0, 32])
    expect(o.irv.rounds[2].counts).toEqual([42, 0, 0, 58])
    expect(o.irv.order).toEqual([3, 0, 1, 2])
  })
  it('explains every pick without gaps', () => {
    for (const r of Object.values(o.results)) expect(explain(r!, o, tn.poll.options)).not.toMatch(/undefined|NaN/)
  })
})

describe('Schulze, Wikipedia example', () => {
  // 45 voters, candidates A-E.
  const g: [number, string][] = [[5, 'ACBED'], [5, 'ADECB'], [8, 'BEDAC'], [3, 'CABED'], [7, 'CAEBD'], [2, 'CBADE'], [7, 'DCEBA'], [8, 'EBADC']]
  const ballots = g.map(([c, s], i) => makeBallot('w' + i, [...s].map((ch) => ch.charCodeAt(0) - 65), c))
  const p = pairwise(5, ballots)
  it('matches the published pairwise matrix', () => {
    expect(p[0]).toEqual([0, 20, 26, 30, 22])
    expect(p[1]).toEqual([25, 0, 16, 33, 18])
    expect(p[2]).toEqual([19, 29, 0, 17, 24])
    expect(p[3]).toEqual([15, 12, 28, 0, 14])
    expect(p[4]).toEqual([23, 27, 21, 31, 0])
  })
  it('ranks E > A > C > B > D with the published strongest paths', () => {
    const r = schulze(p)
    expect(r.order).toEqual([4, 0, 2, 1, 3])
    expect(r.winner).toBe(4)
    expect(r.paths[0]).toEqual([0, 28, 28, 30, 24])
    expect(r.paths[1]).toEqual([25, 0, 28, 33, 24])
    expect(r.paths[2]).toEqual([25, 29, 0, 29, 24])
    expect(r.paths[3]).toEqual([25, 28, 28, 0, 24])
    expect(r.paths[4]).toEqual([25, 28, 28, 31, 0])
  })
  it('Ranked Pairs legitimately differs here: B>A (25) is skipped because A>C>B is locked first', () => {
    const rp = rankedPairs(p)
    expect(rp.order).toEqual([0, 2, 4, 1, 3]) // A > C > E > B > D
    expect(rp.skipped.map(([w, l]) => [w, l])).toEqual([[3, 2], [1, 0], [4, 0]])
  })
  it('Kemeny-Young maximises agreement and also picks E', () => {
    const score = (r: number[]) => r.reduce((t, a, i) => t + r.slice(i + 1).reduce((u, b) => u + p[a][b], 0), 0)
    const k = kemeny(p)!
    expect(k.winner).toBe(4)
    expect(k.kemenyScore).toBe(score(k.order))
    for (const other of [[4, 0, 2, 1, 3], [0, 2, 4, 1, 3]]) expect(k.kemenyScore).toBeGreaterThanOrEqual(score(other))
  })
})

describe('Condorcet cycle', () => {
  const c = PRESETS[1]
  const o = runAll(3, c.ballots)
  it('has no Condorcet winner, loser or small Smith set', () => {
    expect(o.analysis.condorcetWinner).toBeNull()
    expect(o.analysis.condorcetLoser).toBeNull()
    expect(o.analysis.smith).toEqual([0, 1, 2])
    expect(o.results.condorcet!.winner).toBeNull()
    expect(o.analysis.edges).toHaveLength(3)
  })
  it('lets the methods disagree', () => {
    expect(o.results.plurality!.winner).toBe(1)
    expect(o.results.borda!.winner).toBe(2)
    expect(o.results.irv!.winner).toBe(0)
    expect(o.results.schulze!.winner).toBe(2)
    expect(o.rankedPairs.skipped).toHaveLength(1)
  })
})

describe('deterministic ties', () => {
  const cyc = [makeBallot('a', [0, 1, 2]), makeBallot('b', [1, 2, 0]), makeBallot('c', [2, 0, 1])]
  const o = runAll(3, cyc)
  it('reports the tied options and breaks the tie by poll order', () => {
    for (const id of ['plurality', 'borda', 'copeland', 'approval'] as const) {
      expect(o.results[id]!.tied).toEqual([0, 1, 2])
      expect(o.results[id]!.winner).toBe(0)
    }
    expect(o.schulze.tied).toEqual([0, 1, 2])
    expect(o.rankedPairs.tied).toEqual([0, 1, 2])
    expect(o.rankedPairs.tieBreaks).toBe(2)
    expect(o.results.kemeny!.tied).toEqual([0, 1, 2])
    expect(o.kemeny!.optimalRankings).toBe(3)
    expect(explain(o.results.plurality!, o, ['A', 'B', 'C'])).toContain('A, B and C are tied')
  })
  it('flags IRV elimination ties and a final deadlock', () => {
    expect(o.irv.rounds[0].tie).toEqual([0, 1, 2])
    expect(o.irv.rounds[0].eliminated).toBe(2)
    expect(o.irv.tied).toEqual([0, 1, 2]) // whoever is eliminated first decides the winner
    const same = runAll(3, cyc)
    expect(same.results.irv!.winner).toBe(o.results.irv!.winner) // repeatable
  })
  it('is independent of ballot order', () => {
    const rev = runAll(3, [...cyc].reverse())
    expect(rev.results).toEqual({ ...o.results, irv: expect.anything(), schulze: expect.anything(), rankedPairs: expect.anything(), star: expect.anything(), kemeny: expect.anything() })
  })
  it('rankOrder keeps poll order among equals', () => {
    expect(rankOrder([2, 5, 5, 1])).toEqual([1, 2, 0, 3])
  })
})

describe('STAR and approval', () => {
  it('runs the top two scorers through a preference runoff', () => {
    // A has the highest total (one 5 per voter would be 15), B is preferred by the majority.
    const b: Ballot[] = [
      makeBallot('1', [0, 1, 2], 1, [5, 0, 0]),
      makeBallot('2', [1, 0, 2], 1, [3, 4, 0]),
      makeBallot('3', [1, 0, 2], 1, [3, 4, 0]),
    ]
    const o = runAll(3, b)
    expect(o.star.finalists).toEqual([0, 1])
    expect(o.star.runoff).toEqual([1, 2])
    expect(o.star.winner).toBe(1)
    expect(o.results.approval!.scores).toEqual([3, 2, 0])
  })
})

describe('Kemeny-Young', () => {
  it('is skipped above 8 options', () => {
    expect(kemeny(Array.from({ length: 9 }, () => new Array(9).fill(0)))).toBeNull()
    expect(runAll(9, [makeBallot('x', [0, 1, 2, 3, 4, 5, 6, 7, 8])]).results.kemeny).toBeUndefined()
  })
})

describe('method guarantees on random electorates', () => {
  let seed = 7
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  it('Condorcet-consistent methods pick the Condorcet winner; loser-safe methods never pick the loser', () => {
    let withWinner = 0
    for (let t = 0; t < 300; t++) {
      const n = 3 + Math.floor(rnd() * 3)
      const ballots = Array.from({ length: 3 + Math.floor(rnd() * 9) }, (_, i) => {
        const r = [...Array(n).keys()].sort(() => rnd() - 0.5)
        return makeBallot('r' + i, r, 1 + Math.floor(rnd() * 3))
      })
      const o = runAll(n, ballots)
      const { condorcetWinner: cw, condorcetLoser: cl } = o.analysis
      for (const [id, r] of Object.entries(o.results) as [keyof typeof PROPERTIES, NonNullable<ReturnType<typeof runAll>['results']['irv']>][]) {
        if (cw !== null && PROPERTIES[id].condorcet === 'yes') expect(r.winner, id).toBe(cw)
        if (cl !== null && PROPERTIES[id].loser === 'yes') expect(r.winner, id).not.toBe(cl)
      }
      if (cw !== null) withWinner++
      // Schulze's unbeaten set sits inside the Smith set.
      expect(o.schulze.tied.every((i) => o.analysis.smith.includes(i))).toBe(true)
    }
    expect(withWinner).toBeGreaterThan(50)
  })
  it('analyze finds the winner of a clear matrix', () => {
    expect(analyze([[0, 3, 3], [1, 0, 2], [1, 2, 0]]).condorcetWinner).toBe(0)
  })
})
