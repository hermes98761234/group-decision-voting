import type { Analysis, IrvRound } from '../lib/methods'
import { colorOf } from '../lib/util'

/** Row option vs column option: votes preferring the row. Green = row wins, red = row loses. */
export function Heatmap({ p, options, analysis }: { p: number[][]; options: string[]; analysis: Analysis }) {
  const n = options.length
  return (
    <div className="table-wrap">
      <table className="heat">
        <caption className="sr">Pairwise matrix: voters preferring the row option over the column option</caption>
        <thead>
          <tr>
            <th className="corner">over →<br />prefer ↓</th>
            {options.map((o, j) => (
              <th key={j} title={o}>
                <span className="dot" style={{ background: colorOf(j) }} /> {o}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {options.map((o, i) => (
            <tr key={i}>
              <th title={o}>
                <span className="dot" style={{ background: colorOf(i) }} /> {o}
                {analysis.condorcetWinner === i && <span className="tag ok">Condorcet winner</span>}
                {analysis.condorcetLoser === i && <span className="tag bad">Condorcet loser</span>}
              </th>
              {Array.from({ length: n }, (_, j) => {
                if (i === j) return <td key={j} className="diag">–</td>
                const total = p[i][j] + p[j][i]
                const share = total ? p[i][j] / total : 0.5
                const strength = Math.abs(share - 0.5) * 2
                const bg = share === 0.5 ? 'transparent' : share > 0.5 ? `rgba(22,163,74,${0.12 + 0.55 * strength})` : `rgba(220,38,38,${0.12 + 0.55 * strength})`
                return (
                  <td key={j} style={{ background: bg }} title={`${p[i][j]} prefer ${o} over ${options[j]}, ${p[j][i]} the reverse`}>
                    {p[i][j]}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function IrvChart({ rounds, options, voters }: { rounds: IrvRound[]; options: string[]; voters: number }) {
  return (
    <div className="irv">
      {rounds.map((r, k) => {
        const total = r.counts.reduce((s, c, i) => s + (r.active[i] ? c : 0), 0)
        const rows = options.map((_, i) => i).filter((i) => r.active[i]).sort((a, b) => r.counts[b] - r.counts[a] || a - b)
        return (
          <div className="round" key={k}>
            <h4>
              Round {k + 1} <span className="muted">· {total} of {voters} ballots still count</span>
            </h4>
            {rows.map((i) => (
              <div className={`bar-row ${r.eliminated === i ? 'out' : ''}`} key={i}>
                <span className="bar-name">{options[i]}</span>
                <span className="bar-track">
                  <span className="bar" style={{ width: `${total ? (100 * r.counts[i]) / total : 0}%`, background: r.eliminated === i ? undefined : colorOf(i) }} />
                  <span className="half" title="Majority line" />
                </span>
                <span className="bar-val">
                  {r.counts[i]}
                  {r.eliminated === i && ' ✕'}
                  {r.eliminated === null && r.counts[i] * 2 > total && ' ✓'}
                </span>
              </div>
            ))}
            {r.tie.length > 1 && (
              <p className="small warn">
                Tie for last place between {r.tie.map((i) => options[i]).join(', ')}: the one listed latest in the poll goes out.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Majority preferences among the Smith set drawn as arrows (A → B means more voters prefer A to B). */
export function CycleGraph({ analysis, options, p }: { analysis: Analysis; options: string[]; p: number[][] }) {
  const nodes = analysis.smith
  const W = 360
  const H = 300
  const cx = W / 2
  const cy = H / 2 + 6
  const R = 105
  const pos = new Map(nodes.map((o, k) => [o, [cx + R * Math.sin((2 * Math.PI * k) / nodes.length), cy - R * Math.cos((2 * Math.PI * k) / nodes.length)] as const]))
  const edges = analysis.edges.filter(([a, b]) => pos.has(a) && pos.has(b))
  const r = 22
  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Majority cycle among ${nodes.map((o) => options[o]).join(', ')}`}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="currentColor" />
        </marker>
      </defs>
      {edges.map(([a, b, m]) => {
        const [x1, y1] = pos.get(a)!
        const [x2, y2] = pos.get(b)!
        const d = Math.hypot(x2 - x1, y2 - y1)
        const ux = (x2 - x1) / d
        const uy = (y2 - y1) / d
        // bend each arrow slightly so opposite directions never overlap
        const mx = (x1 + x2) / 2 - uy * 14
        const my = (y1 + y2) / 2 + ux * 14
        return (
          <g key={`${a}-${b}`} className="edge">
            <path d={`M${x1 + ux * r} ${y1 + uy * r} Q${mx} ${my} ${x2 - ux * (r + 4)} ${y2 - uy * (r + 4)}`} fill="none" stroke="currentColor" strokeWidth="2" markerEnd="url(#arrow)" />
            <text x={(x1 + x2) / 2 - uy * 24} y={(y1 + y2) / 2 + ux * 24} textAnchor="middle" dominantBaseline="middle" className="elabel">
              {p[a][b]}–{p[b][a]}
            </text>
            <title>{`${options[a]} beats ${options[b]} by ${m}`}</title>
          </g>
        )
      })}
      {nodes.map((o) => {
        const [x, y] = pos.get(o)!
        return (
          <g key={o}>
            <circle cx={x} cy={y} r={r} fill={colorOf(o)} />
            <text x={x + ((x - cx) / R) * (r + 16)} y={y + ((y - cy) / R) * (r + 12) + 4} textAnchor="middle" className="nlabel">
              {options[o].length > 16 ? options[o].slice(0, 15) + '…' : options[o]}
            </text>
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight="700" fontSize="15">
              {options[o].slice(0, 1).toUpperCase()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
