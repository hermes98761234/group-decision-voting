import type { Outcome } from './run'
import type { MethodId, MethodResult } from './types'

export const METHOD_NAMES: Record<MethodId, string> = {
  plurality: 'Plurality',
  borda: 'Borda count',
  irv: 'Instant-runoff (IRV)',
  condorcet: 'Condorcet winner',
  copeland: 'Copeland',
  schulze: 'Schulze',
  rankedPairs: 'Ranked Pairs (Tideman)',
  approval: 'Approval',
  star: 'STAR',
  kemeny: 'Kemeny-Young',
}

export type Level = 'yes' | 'no' | 'partial'

export interface Criterion {
  id: 'condorcet' | 'loser' | 'majority' | 'monotone' | 'clones'
  name: string
  text: string
}

export const CRITERIA: Criterion[] = [
  { id: 'condorcet', name: 'Condorcet', text: 'If one option beats every other in head-to-head votes, it wins.' },
  { id: 'loser', name: 'Condorcet loser', text: 'An option that loses every head-to-head vote never wins.' },
  { id: 'majority', name: 'Majority', text: 'An option ranked first by more than half the voters wins.' },
  { id: 'monotone', name: 'Monotonicity', text: 'Ranking an option higher can never make it lose, and ranking it lower can never make it win.' },
  { id: 'clones', name: 'Clone independence', text: 'Adding a near-identical copy of an option does not change who wins (apart from the copies).' },
]

/** Textbook properties (e.g. Wikipedia "Comparison of electoral systems"); STAR is for the score ballots. */
export const PROPERTIES: Record<MethodId, Record<Criterion['id'], Level>> = {
  plurality: { condorcet: 'no', loser: 'no', majority: 'yes', monotone: 'yes', clones: 'no' },
  borda: { condorcet: 'no', loser: 'yes', majority: 'no', monotone: 'yes', clones: 'no' },
  irv: { condorcet: 'no', loser: 'yes', majority: 'yes', monotone: 'no', clones: 'yes' },
  condorcet: { condorcet: 'yes', loser: 'yes', majority: 'yes', monotone: 'yes', clones: 'yes' },
  copeland: { condorcet: 'yes', loser: 'yes', majority: 'yes', monotone: 'yes', clones: 'no' },
  schulze: { condorcet: 'yes', loser: 'yes', majority: 'yes', monotone: 'yes', clones: 'yes' },
  rankedPairs: { condorcet: 'yes', loser: 'yes', majority: 'yes', monotone: 'yes', clones: 'yes' },
  approval: { condorcet: 'no', loser: 'no', majority: 'no', monotone: 'yes', clones: 'partial' },
  star: { condorcet: 'no', loser: 'yes', majority: 'no', monotone: 'yes', clones: 'no' },
  kemeny: { condorcet: 'yes', loser: 'yes', majority: 'yes', monotone: 'yes', clones: 'no' },
}

const list = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

/** One-sentence reason for a method's pick, in plain language. */
export function explain(r: MethodResult, o: Outcome, opts: string[]): string {
  const name = (i: number) => opts[i]
  const w = r.winner === null ? -1 : r.winner
  const V = o.voters
  const wn = w >= 0 ? name(w) : ''
  const tie =
    r.tied.length < 2
      ? ''
      : r.id === 'irv' || r.id === 'rankedPairs'
        ? ` A tie inside the count could swing this: ${list(r.tied.map(name))} each win under some tie-break. Ties go to the option listed first in the poll.`
        : ` ${list(r.tied.map(name))} are tied; the one listed first in the poll is picked.`
  let t: string
  switch (r.id) {
    case 'plurality':
      t = `${wn} has the most first-place votes (${r.scores[w]} of ${V}); later preferences are ignored.`
      break
    case 'borda':
      t = `${wn} scores the most points (${r.scores[w]}) when each ballot gives ${o.n - 1} points to its first choice, down to 0 for its last.`
      break
    case 'irv': {
      const out = o.irv.rounds.filter((x) => x.eliminated !== null).map((x) => name(x.eliminated!))
      t = out.length
        ? `Dropping the option with the fewest first choices each round (${list(out)}) and moving those ballots to their next choice leaves ${wn} with ${r.scores[w]} of ${V}.`
        : `${wn} already has a majority of first choices (${r.scores[w]} of ${V}).`
      break
    }
    case 'condorcet':
      t =
        w >= 0
          ? `${wn} beats every other option in a head-to-head vote.`
          : `No option beats all the others. Majorities prefer ${list(o.analysis.smith.map(name))} in a cycle, so there is no Condorcet winner.`
      break
    case 'copeland':
      t = `${wn} wins ${r.scores[w]} of ${o.n - 1} head-to-head matchups (a tied matchup counts half).`
      break
    case 'schulze':
      t = `${wn} has a chain of head-to-head wins at least as strong as any chain back against it.`
      break
    case 'rankedPairs':
      t = `Majority preferences are locked in from the biggest majority down, skipping any that would close a cycle (${o.rankedPairs.skipped.length} skipped); ${wn} ends up with nobody locked above it.`
      break
    case 'approval':
      t = `${wn} is approved (scored 3 or more) by ${r.scores[w]} of ${V} voters.`
      break
    case 'star': {
      const [a, b] = o.star.finalists
      const [ra, rb] = o.star.runoff
      t = `${name(a)} and ${name(b)} have the highest total scores; in the automatic runoff ${ra} voters score ${name(a)} higher and ${rb} score ${name(b)} higher.`
      break
    }
    case 'kemeny': {
      const k = o.kemeny!
      t = `The ranking ${k.order.map(name).join(' > ')} matches the most pairwise votes (${k.kemenyScore}); ${wn} comes first in it.`
      break
    }
  }
  return t + tie
}

export interface Disagreement {
  groups: { winner: number | null; methods: MethodId[] }[]
  agree: boolean
}

export function disagreement(o: Outcome, ids: MethodId[]): Disagreement {
  const groups: Disagreement['groups'] = []
  for (const id of ids) {
    const r = o.results[id]
    if (!r) continue
    let g = groups.find((x) => x.winner === r.winner)
    if (!g) groups.push((g = { winner: r.winner, methods: [] }))
    g.methods.push(id)
  }
  const real = groups.filter((g) => g.winner !== null)
  return { groups: real.sort((a, b) => b.methods.length - a.methods.length), agree: real.length <= 1 }
}
