import { useEffect, useMemo, useState } from 'react'
import { BallotsTab } from './components/BallotsTab'
import { CollectTab } from './components/CollectTab'
import { PassPhone } from './components/PassPhone'
import { PollSetup } from './components/PollSetup'
import { Results } from './components/Results'
import { VoterView } from './components/VoterView'
import { isPermutation, validatePoll } from './lib/ballots'
import { decodePoll } from './lib/codec'
import { PRESETS } from './lib/presets'
import { MAX_OPTIONS, type Ballot, type Poll } from './lib/types'

type Tab = 'poll' | 'vote' | 'ballots' | 'results'
const TABS: [Tab, string][] = [
  ['poll', '1 Poll'],
  ['vote', '2 Collect'],
  ['ballots', '3 Ballots'],
  ['results', '4 Results'],
]
const KEY = 'group-decision-voting:v1'

interface Saved {
  poll: Poll
  ballots: Ballot[]
  tab: Tab
}

function load(): Saved {
  const fallback: Saved = { poll: PRESETS[0].poll, ballots: PRESETS[0].ballots, tab: 'results' }
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    if (!s || !Array.isArray(s.poll?.options) || s.poll.options.length > MAX_OPTIONS || !TABS.some(([t]) => t === s.tab)) return fallback
    const n = s.poll.options.length
    const ok = s.ballots.every((b) => isPermutation(b.ranking, n) && b.scores.length === n && b.count >= 1)
    return ok ? s : fallback
  } catch {
    return fallback
  }
}

const base = () => location.origin + location.pathname

export default function App() {
  // Hash routes: #v=<poll> opens a voter's ballot; #b=<code> pre-fills the organiser's paste box.
  const [voterPoll] = useState(() => decodePoll(new URLSearchParams(location.hash.slice(1)).get('v') ?? ''))
  const [prefill] = useState(() => new URLSearchParams(location.hash.slice(1)).get('b') ?? '')
  const [saved, setSaved] = useState<Saved>(() => {
    const s = load()
    return prefill ? { ...s, tab: 'ballots' } : s
  })
  const [passing, setPassing] = useState(false)
  const { poll, ballots, tab } = saved
  const valid = useMemo(() => validatePoll(poll) === null, [poll])

  useEffect(() => {
    if (!voterPoll) localStorage.setItem(KEY, JSON.stringify(saved))
  }, [saved, voterPoll])
  useEffect(() => {
    if (prefill) history.replaceState(null, '', location.pathname)
  }, [prefill])
  useEffect(() => {
    document.title = voterPoll ? `${voterPoll.title} – vote` : 'Group Decision Voting: ranked ballots, 10 voting methods compared'
  }, [voterPoll])

  if (voterPoll) return <VoterView poll={voterPoll} base={base()} />

  const set = (patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch }))

  if (passing) {
    return (
      <main className="app narrow">
        <PassPhone
          poll={poll}
          onCast={(b) => setSaved((s) => ({ ...s, ballots: [...s.ballots, b] }))}
          onFinish={() => {
            setPassing(false)
            set({ tab: 'results' })
          }}
        />
      </main>
    )
  }

  return (
    <main className="app">
      <header className="top">
        <h1>Group Decision Voting</h1>
        <p className="muted">
          Collect ranked ballots from friends, a club or a team, then see how ten voting methods (plurality, Borda, IRV, Condorcet, Schulze, Ranked Pairs, Copeland, approval, STAR, Kemeny-Young) pick differently. Everything stays in your browser.
        </p>
      </header>
      <nav className="tabs" role="tablist">
        {TABS.map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => set({ tab: t })}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'poll' && (
        <PollSetup
          poll={poll}
          hasBallots={ballots.length > 0}
          onPoll={(p, clear) => set({ poll: p, ...(clear ? { ballots: [] } : {}) })}
          onPreset={(p) => set({ poll: p.poll, ballots: p.ballots, tab: p.ballots.length ? 'results' : 'vote' })}
        />
      )}
      {tab === 'vote' && <CollectTab poll={poll} valid={valid} base={base()} onPass={() => setPassing(true)} />}
      {tab === 'ballots' && <BallotsTab poll={poll} valid={valid} ballots={ballots} prefill={prefill} onChange={(b) => set({ ballots: b })} />}
      {tab === 'results' && <Results poll={poll} ballots={ballots} goto={(t) => set({ tab: t })} />}
      <footer className="foot muted small">
        Methods follow Schulze (2011), Tideman (1987), Kemeny (1959) and the STAR Voting spec. No server, no tracking.
      </footer>
    </main>
  )
}
