import { validatePoll } from '../lib/ballots'
import { PRESETS, type Preset } from '../lib/presets'
import { MAX_OPTIONS, type Poll } from '../lib/types'
import { colorOf } from '../lib/util'

interface Props {
  poll: Poll
  hasBallots: boolean
  onPoll: (poll: Poll, clearBallots: boolean) => void
  onPreset: (p: Preset) => void
}

export function PollSetup({ poll, hasBallots, onPoll, onPreset }: Props) {
  const problem = validatePoll(poll)
  const restructure = (options: string[]) => {
    if (hasBallots && !window.confirm('Changing the number of options removes the ballots collected so far. Continue?')) return
    onPoll({ ...poll, options }, hasBallots)
  }
  return (
    <section className="card">
      <h2>Your poll</h2>
      <div className="presets">
        <span className="muted">Start from</span>
        {PRESETS.map((p) => (
          <button type="button" key={p.id} onClick={() => onPreset(p)} title={p.blurb}>
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPreset({ id: 'blank', label: '', blurb: '', poll: { title: 'My poll', options: ['Option A', 'Option B', 'Option C'] }, ballots: [] })}
        >
          Blank poll
        </button>
      </div>
      <label className="field">
        <span>Question</span>
        <input value={poll.title} maxLength={120} onChange={(e) => onPoll({ ...poll, title: e.target.value }, false)} placeholder="What are we deciding?" />
      </label>
      <div className="field">
        <span>Options ({poll.options.length} of {MAX_OPTIONS})</span>
        <ul className="opt-list">
          {poll.options.map((o, i) => (
            <li key={i}>
              <span className="dot" style={{ background: colorOf(i) }} />
              <input
                value={o}
                maxLength={60}
                aria-label={`Option ${i + 1}`}
                onChange={(e) => onPoll({ ...poll, options: poll.options.map((x, k) => (k === i ? e.target.value : x)) }, false)}
              />
              <button type="button" className="icon" aria-label={`Remove ${o || 'option'}`} disabled={poll.options.length <= 2} onClick={() => restructure(poll.options.filter((_, k) => k !== i))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button type="button" disabled={poll.options.length >= MAX_OPTIONS} onClick={() => restructure([...poll.options, `Option ${String.fromCharCode(65 + poll.options.length)}`])}>
          + Add option
        </button>
      </div>
      {problem && <p className="error">{problem}</p>}
      <p className="muted small">
        Renaming an option or the question changes the poll's fingerprint, so ballot codes already handed out will be rejected. Rename before sharing the link.
      </p>
    </section>
  )
}
