import { useRef, useState } from 'react'
import { makeBallot } from '../lib/ballots'
import { decodeBallot, extractCodes, newBallotId } from '../lib/codec'
import { exportBallotsCsv, importCsv } from '../lib/csv'
import type { Ballot, Poll } from '../lib/types'
import { download, slug } from '../lib/util'
import { BallotForm } from './BallotForm'

interface Props {
  poll: Poll
  valid: boolean
  ballots: Ballot[]
  prefill: string
  onChange: (b: Ballot[]) => void
}

export function BallotsTab({ poll, valid, ballots, prefill, onChange }: Props) {
  const [text, setText] = useState(prefill)
  const [notes, setNotes] = useState<string[]>([])
  const [manual, setManual] = useState(false)
  const [count, setCount] = useState(1)
  const file = useRef<HTMLInputElement>(null)
  if (!valid) return <section className="card"><p className="error">Fix the poll first (see the Poll tab).</p></section>

  const addCodes = () => {
    const seen = new Set(ballots.map((b) => b.id))
    const added: Ballot[] = []
    const msgs: string[] = []
    for (const code of extractCodes(text)) {
      try {
        const b = decodeBallot(code, poll)
        if (seen.has(b.id)) msgs.push(`Skipped a duplicate: ${code}`)
        else {
          seen.add(b.id)
          added.push(b)
        }
      } catch (e) {
        msgs.push(`Rejected "${code.length > 24 ? code.slice(0, 24) + '…' : code}": ${(e as Error).message}.`)
      }
    }
    if (added.length) onChange([...ballots, ...added])
    setNotes([`Added ${added.length} ballot${added.length === 1 ? '' : 's'}.`, ...msgs])
    if (!msgs.length) setText('')
  }
  const readFile = async (f: File | undefined) => {
    if (!f) return
    const { ballots: added, errors } = importCsv(await f.text(), poll)
    if (added.length) onChange([...ballots, ...added])
    setNotes([`Imported ${added.length} CSV row${added.length === 1 ? '' : 's'}.`, ...errors])
    if (file.current) file.current.value = ''
  }
  const total = ballots.reduce((s, b) => s + b.count, 0)

  return (
    <div className="grid2">
      <section className="card">
        <h2>Add ballots</h2>
        <label className="field">
          <span>Paste ballot codes or links (one per line)</span>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder="Codes that voters sent back" />
        </label>
        <div className="row">
          <button type="button" className="primary" onClick={addCodes} disabled={!text.trim()}>
            Add pasted ballots
          </button>
          <button type="button" onClick={() => file.current?.click()}>
            Import CSV…
          </button>
          <input ref={file} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => readFile(e.target.files?.[0])} />
        </div>
        <p className="muted small">
          CSV rows list the options best first (<code>Memphis,Nashville,…</code>), optionally with a leading count (<code>42,Memphis,…</code>), or give each option's rank in poll order (<code>2,1,3</code>).
        </p>
        {notes.length > 0 && (
          <ul className="notes" role="status">
            {notes.map((n, i) => (
              <li key={i} className={i > 0 ? 'error' : ''}>
                {n}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => setManual(!manual)} aria-expanded={manual}>
          {manual ? 'Hide manual entry' : 'Enter a ballot by hand'}
        </button>
        {manual && (
          <div className="manual">
            <label className="field inline">
              <span>Identical ballots</span>
              <input type="number" min={1} max={9999} value={count} onChange={(e) => setCount(Math.max(1, Math.floor(Number(e.target.value)) || 1))} />
            </label>
            <BallotForm key={ballots.length} options={poll.options} submitLabel="Add this ballot" onSubmit={(r, s) => onChange([...ballots, makeBallot(newBallotId(), r, count, s)])} />
          </div>
        )}
      </section>
      <section className="card">
        <h2>
          Ballots <span className="muted">({total} voter{total === 1 ? '' : 's'})</span>
        </h2>
        {ballots.length === 0 ? (
          <p className="muted">No ballots yet.</p>
        ) : (
          <div className="table-wrap tall">
            <table>
              <thead>
                <tr>
                  <th>×</th>
                  <th>Ranking (best first)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ballots.map((b) => (
                  <tr key={b.id}>
                    <td className="num">{b.count}</td>
                    <td>{b.ranking.map((o) => poll.options[o]).join(' › ')}</td>
                    <td>
                      <button type="button" className="icon" aria-label="Remove ballot" onClick={() => onChange(ballots.filter((x) => x !== b))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row">
          <button type="button" disabled={!ballots.length} onClick={() => download(`${slug(poll.title)}-ballots.csv`, exportBallotsCsv(ballots, poll))}>
            Export CSV
          </button>
          <button type="button" disabled={!ballots.length} onClick={() => window.confirm('Remove all ballots?') && onChange([])}>
            Clear all
          </button>
        </div>
      </section>
    </div>
  )
}
