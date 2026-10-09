import { useMemo } from 'react'
import { CRITERIA, METHOD_NAMES, PROPERTIES, disagreement, explain, type Level } from '../lib/explain'
import { toCsv } from '../lib/csv'
import { METHOD_ORDER, runAll } from '../lib/run'
import { KEMENY_MAX, type Ballot, type Poll } from '../lib/types'
import { colorOf, download, slug } from '../lib/util'
import { CycleGraph, Heatmap, IrvChart } from './Charts'

const MARK: Record<Level, string> = { yes: '✓', no: '✗', partial: '~' }

export function Results({ poll, ballots, goto }: { poll: Poll; ballots: Ballot[]; goto: (tab: 'ballots' | 'vote') => void }) {
  const opts = poll.options
  const o = useMemo(() => (ballots.length ? runAll(opts.length, ballots) : null), [opts.length, ballots])
  if (!o) {
    return (
      <section className="card">
        <h2>No ballots yet</h2>
        <p>Collect ballots first: <button type="button" onClick={() => goto('vote')}>pass the phone or share a link</button>, or <button type="button" onClick={() => goto('ballots')}>paste codes / import CSV</button>.</p>
      </section>
    )
  }
  const chip = (i: number | null) =>
    i === null ? <span className="muted">no winner</span> : <span className="chip"><span className="dot" style={{ background: colorOf(i) }} />{opts[i]}</span>
  const d = disagreement(o, METHOD_ORDER)
  const a = o.analysis
  const rows = METHOD_ORDER.map((id) => o.results[id])
  const exportCsv = () =>
    download(
      `${slug(poll.title)}-results.csv`,
      toCsv([
        ['method', 'winner', 'tied for first', 'full order', 'why'],
        ...METHOD_ORDER.flatMap((id) => {
          const r = o.results[id]
          return r ? [[METHOD_NAMES[id], r.winner === null ? '(none)' : opts[r.winner], r.tied.length > 1 ? r.tied.map((i) => opts[i]).join(' / ') : '', r.order.map((i) => opts[i]).join(' > '), explain(r, o, opts)]] : []
        }),
      ]),
    )

  return (
    <div className="results">
      <section className="card verdict">
        <div className="row spread">
          <h2>{poll.title || 'Untitled poll'}</h2>
          <div className="row">
            <button type="button" onClick={exportCsv}>Export CSV</button>
            <button type="button" onClick={() => window.print()}>Print / PDF</button>
          </div>
        </div>
        <p className="muted">{o.voters} voter{o.voters === 1 ? '' : 's'}, {opts.length} options</p>
        {d.agree ? (
          <p className="big">All methods agree: {chip(d.groups[0]?.winner ?? null)}</p>
        ) : (
          <>
            <p className="big warn">The methods disagree. The choice of voting rule changes the outcome.</p>
            <ul className="groups">
              {d.groups.map((g) => (
                <li key={g.winner}>
                  {chip(g.winner)} <span className="muted">{g.methods.length} method{g.methods.length === 1 ? '' : 's'}:</span> {g.methods.map((m) => METHOD_NAMES[m]).join(', ')}
                </li>
              ))}
            </ul>
          </>
        )}
        <p>
          {a.condorcetWinner !== null ? (
            <>Condorcet winner: {chip(a.condorcetWinner)} beats every other option head to head.</>
          ) : (
            <>No Condorcet winner: majorities prefer {a.smith.map((i) => opts[i]).join(' › ')} in a cycle (the Condorcet paradox).</>
          )}{' '}
          {a.condorcetLoser !== null && <>Condorcet loser: {chip(a.condorcetLoser)} loses to everyone.</>}
        </p>
      </section>

      <section className="card">
        <h2>Which method picks whom, and why</h2>
        <div className="table-wrap">
          <table className="methods">
            <thead>
              <tr><th>Method</th><th>Winner</th><th>Full order</th><th>Why</th></tr>
            </thead>
            <tbody>
              {rows.map((r, k) => {
                const id = METHOD_ORDER[k]
                if (!r) return <tr key={id}><td>{METHOD_NAMES[id]}</td><td colSpan={3} className="muted">Needs {KEMENY_MAX} or fewer options (it checks every possible ranking).</td></tr>
                const odd = !d.agree && r.winner !== null && r.winner !== d.groups[0].winner
                return (
                  <tr key={id} className={odd ? 'odd' : ''}>
                    <th scope="row">{METHOD_NAMES[id]}</th>
                    <td>
                      {chip(r.winner)}
                      {r.tied.length > 1 && <span className="tag warn" title={`Tied: ${r.tied.map((i) => opts[i]).join(', ')}`}>tie</span>}
                    </td>
                    <td className="order">{r.order.map((i) => opts[i]).join(' › ')}</td>
                    <td>{explain(r, o, opts)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">Ties are never random: tied options are reported, and the one listed first in the poll is picked. Method-specific tie rules are noted in the Why column.</p>
      </section>

      <div className="grid2 wide-left">
        <section className="card">
          <h2>Head-to-head matrix</h2>
          <Heatmap p={o.pairwise} options={opts} analysis={a} />
          <p className="muted small">Each cell counts voters who rank the row option above the column option. Green: the row option wins that pairing. Red: it loses.</p>
        </section>
        <section className="card">
          <h2>{a.smith.length > 1 ? 'Majority cycle' : 'Majority graph'}</h2>
          {a.smith.length > 1 ? (
            <>
              <CycleGraph analysis={a} options={opts} p={o.pairwise} />
              <p className="muted small">
                An arrow points from the option more voters prefer to the one they like less (votes shown for–against). With no unbeaten option, Condorcet-style methods have to break the cycle, and each does it differently: Schulze picks {chipText(o.schulze.winner, opts)}, Ranked Pairs {chipText(o.rankedPairs.winner, opts)}, Copeland {o.results.copeland!.tied.length > 1 ? 'a tie' : chipText(o.results.copeland!.winner, opts)}.
              </p>
            </>
          ) : (
            <p>{chip(a.smith[0])} beats every other option one on one, so there is no cycle to resolve and every Condorcet-consistent method picks it.</p>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Instant-runoff, round by round</h2>
        <IrvChart rounds={o.irv.rounds} options={opts} voters={o.voters} />
      </section>

      <section className="card">
        <h2>Properties of each method</h2>
        <div className="table-wrap">
          <table className="props">
            <thead>
              <tr>
                <th>Method</th>
                {CRITERIA.map((c) => <th key={c.id} title={c.text}>{c.name}</th>)}
                <th>Here</th>
              </tr>
            </thead>
            <tbody>
              {METHOD_ORDER.map((id) => {
                const r = o.results[id]
                const here =
                  !r ? '' : a.condorcetWinner === null ? (a.condorcetLoser !== null && r.winner === a.condorcetLoser ? 'picked the Condorcet loser' : '') : r.winner === a.condorcetWinner ? 'picked the Condorcet winner' : 'missed the Condorcet winner'
                return (
                  <tr key={id}>
                    <th scope="row">{METHOD_NAMES[id]}</th>
                    {CRITERIA.map((c) => <td key={c.id} className={`lv ${PROPERTIES[id][c.id]}`} aria-label={PROPERTIES[id][c.id]}>{MARK[PROPERTIES[id][c.id]]}</td>)}
                    <td className={here.startsWith('missed') || here.includes('loser') ? 'bad-text' : ''}>{here}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <dl className="criteria">
          {CRITERIA.map((c) => (
            <div key={c.id}>
              <dt>{c.name}</dt>
              <dd>{c.text}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">
          ✓ guaranteed, ✗ can fail, ~ depends on how it is defined. No ranked method has all of them (Arrow's and Gibbard–Satterthwaite's theorems), which is why the methods can disagree. The Condorcet-style methods (Schulze, Ranked Pairs, Copeland, Kemeny-Young) always pick the Condorcet winner when one exists; IRV and Plurality can miss it, and IRV can even hurt a candidate for gaining support (non-monotonicity).
        </p>
      </section>
    </div>
  )
}

const chipText = (i: number | null, opts: string[]) => (i === null ? 'nobody' : opts[i])
