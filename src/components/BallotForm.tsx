import { useState } from 'react'
import { defaultScores } from '../lib/ballots'
import { APPROVAL_MIN, MAX_SCORE } from '../lib/types'
import { colorOf } from '../lib/util'

function shuffled(n: number): number[] {
  const a = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Props {
  options: string[]
  submitLabel: string
  onSubmit: (ranking: number[], scores: number[]) => void
}

/** Rank by moving options up and down; optionally tune the 0-5 score of each place (used by STAR and approval). */
export function BallotForm({ options, submitLabel, onSubmit }: Props) {
  const n = options.length
  // Starting from a random order keeps the poll's own option order from nudging anyone's ranking.
  const [order, setOrder] = useState(() => shuffled(n))
  const [slot, setSlot] = useState(() => defaultScores([...Array(n).keys()]))

  const move = (p: number, d: -1 | 1) => {
    const q = p + d
    if (q < 0 || q >= n) return
    const next = [...order]
    ;[next[p], next[q]] = [next[q], next[p]]
    setOrder(next)
  }
  const setScore = (p: number, v: number) =>
    setSlot(slot.map((s, i) => (i < p ? Math.max(s, v) : i > p ? Math.min(s, v) : v)))
  const submit = () => {
    const scores = new Array<number>(n).fill(0)
    order.forEach((o, p) => (scores[o] = slot[p]))
    onSubmit(order, scores)
  }

  return (
    <div className="ballot">
      <p className="muted">Put your favourite first. Use the arrows to reorder; every option must be ranked.</p>
      <ol className="rank-list">
        {order.map((o, p) => (
          <li key={o}>
            <span className="rank-no">{p + 1}</span>
            <span className="dot" style={{ background: colorOf(o) }} />
            <span className="rank-name">{options[o]}</span>
            <label className="score" title="Score for STAR voting. Scores of 3 or more also count as approval.">
              <span className="sr">Score for {options[o]}</span>
              <select value={slot[p]} onChange={(e) => setScore(p, Number(e.target.value))}>
                {Array.from({ length: MAX_SCORE + 1 }, (_, s) => (
                  <option key={s} value={s}>
                    {s} {s >= APPROVAL_MIN ? '✓' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="icon" onClick={() => move(p, -1)} disabled={p === 0} aria-label={`Move ${options[o]} up`}>
              ↑
            </button>
            <button type="button" className="icon" onClick={() => move(p, 1)} disabled={p === n - 1} aria-label={`Move ${options[o]} down`}>
              ↓
            </button>
          </li>
        ))}
      </ol>
      <p className="muted small">
        Score 0 to {MAX_SCORE} for each place is used by STAR voting; ✓ (score {APPROVAL_MIN}+) means you approve of it. The defaults spread evenly, so you can ignore them.
      </p>
      <button type="button" className="primary" onClick={submit}>
        {submitLabel}
      </button>
    </div>
  )
}
