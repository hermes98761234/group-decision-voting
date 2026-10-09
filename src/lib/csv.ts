import { isPermutation, makeBallot } from './ballots'
import { newBallotId } from './codec'
import type { Ballot, Poll } from './types'

export function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0]
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const endCell = () => {
    row.push(cell.trim())
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delim) endCell()
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      endCell()
      rows.push(row)
      row = []
    } else cell += c
  }
  if (cell !== '' || row.length) {
    endCell()
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c !== ''))
}

const quote = (s: string) => (/[",;\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => quote(String(c))).join(',')).join('\n') + '\n'

/**
 * Accepted rows (after an optional header):
 *  - n option names, best first            "Nashville,Memphis,Knoxville"
 *  - a count, then n option names          "42,Memphis,Nashville,..."
 *  - n ranks, one per option in poll order "1,3,2" (1 = best)
 * Scores are not part of the CSV; they are derived from the ranking.
 */
export function importCsv(text: string, poll: Poll): { ballots: Ballot[]; errors: string[] } {
  const n = poll.options.length
  const index = new Map(poll.options.map((o, i) => [o.trim().toLowerCase(), i]))
  const ballots: Ballot[] = []
  const errors: string[] = []
  const rows = parseCsv(text)
  const isInt = (s: string) => /^\d+$/.test(s)
  rows.forEach((row, r) => {
    const names = (cells: string[]) => cells.map((c) => index.get(c.toLowerCase()))
    let count = 1
    let cells = row
    if (r === 0 && (cells[0].toLowerCase() === 'count' || (cells.every((c) => index.has(c.toLowerCase())) && rows.slice(1).some((x) => x.every(isInt))))) return // header
    if (cells.length === n + 1 && isInt(cells[0]) && Number(cells[0]) > 0) {
      count = Number(cells[0])
      cells = cells.slice(1)
    }
    let ranking: number[]
    if (cells.length === n && cells.every(isInt) && isPermutation(cells.map((c) => Number(c) - 1), n)) {
      const ranks = cells.map(Number)
      ranking = Array.from({ length: n }, (_, k) => ranks.indexOf(k + 1))
    } else {
      ranking = names(cells) as number[]
      if (cells.length !== n || !isPermutation(ranking, n)) {
        errors.push(`Row ${r + 1}: expected each of the ${n} options exactly once.`)
        return
      }
    }
    ballots.push(makeBallot(newBallotId(), ranking, count))
  })
  return { ballots, errors }
}

export function exportBallotsCsv(ballots: readonly Ballot[], poll: Poll): string {
  const header = ['count', ...poll.options.map((_, i) => `choice ${i + 1}`)]
  return toCsv([header, ...ballots.map((b) => [b.count, ...b.ranking.map((o) => poll.options[o])])])
}
