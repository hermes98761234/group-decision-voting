import { describe, expect, it } from 'vitest'
import { makeBallot } from './ballots'
import { decodeBallot, decodePoll, encodeBallot, encodePoll, extractCodes, newBallotId, pollHash } from './codec'
import { exportBallotsCsv, importCsv, parseCsv } from './csv'
import { PRESETS } from './presets'

const poll = PRESETS[2].poll

describe('ballot codes', () => {
  it('round-trips ranking, scores and id', () => {
    const b = makeBallot(newBallotId(), [3, 0, 4, 1, 2], 1, [5, 2, 0, 5, 3])
    const code = encodeBallot(b, poll)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(code.length).toBeLessThanOrEqual(24)
    expect(decodeBallot(code, poll)).toEqual(b)
  })
  it('round-trips every size from 2 to 12 options', () => {
    for (let n = 2; n <= 12; n++) {
      const p = { title: 'T', options: Array.from({ length: n }, (_, i) => 'o' + i) }
      const ranking = [...Array(n).keys()].reverse()
      const b = makeBallot('0a1b2c', ranking)
      expect(decodeBallot(encodeBallot(b, p), p)).toEqual(b)
    }
  })
  it('rejects ballots for another poll, other option counts and garbage', () => {
    const code = encodeBallot(makeBallot('aabbcc', [0, 1, 2, 3, 4]), poll)
    expect(() => decodeBallot(code, { ...poll, title: 'Other' })).toThrow('different poll')
    expect(() => decodeBallot(code, { title: 'x', options: ['a', 'b'] })).toThrow('different number')
    expect(() => decodeBallot('hello!', poll)).toThrow()
    expect(() => decodeBallot(code.slice(0, -2), poll)).toThrow()
  })
  it('finds codes inside links and lists', () => {
    expect(extractCodes('https://x.io/app/#b=AbC_-1\nXyz, Q1;  http://a/b?b=Zed')).toEqual(['AbC_-1', 'Xyz', 'Q1', 'Zed'])
  })
  it('fingerprints the poll text', () => {
    expect(pollHash(poll)).toBe(pollHash({ ...poll }))
    expect(pollHash(poll)).not.toBe(pollHash({ ...poll, options: [...poll.options].reverse() }))
  })
})

describe('poll links', () => {
  it('round-trips unicode titles and options', () => {
    const p = { title: 'Куди підемо? 🍕', options: ['Піца', 'Суші', 'Pierogi "deluxe", yes'] }
    expect(decodePoll(encodePoll(p))).toEqual(p)
  })
  it('refuses broken input', () => {
    expect(decodePoll('%%%')).toBeNull()
    expect(decodePoll(encodePoll({ title: 't', options: ['same', 'same'] }))).toBeNull()
  })
})

describe('CSV', () => {
  const p = { title: 't', options: ['Memphis', 'Nashville', 'Knoxville'] }
  it('imports names, counts and rank columns', () => {
    const { ballots, errors } = importCsv('3,nashville,KNOXVILLE,Memphis\nMemphis,Nashville,Knoxville\n3,2,1\n', p)
    expect(errors).toEqual([])
    expect(ballots.map((b) => [b.count, b.ranking])).toEqual([[3, [1, 2, 0]], [1, [0, 1, 2]], [1, [2, 1, 0]]])
  })
  it('skips a header row and reports bad rows', () => {
    const { ballots, errors } = importCsv('Memphis;Nashville;Knoxville\n1;2;3\nMemphis;Memphis;Knoxville\n', p)
    expect(ballots).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Row 3')
  })
  it('handles quotes and exports what it imports', () => {
    expect(parseCsv('"a,b",c\n"say ""hi""",d')).toEqual([['a,b', 'c'], ['say "hi"', 'd']])
    const q = { title: 't', options: ['Rock, hard', 'Pop'] }
    const orig = [makeBallot('1', [1, 0], 4), makeBallot('2', [0, 1])]
    const back = importCsv(exportBallotsCsv(orig, q), q)
    expect(back.errors).toEqual([])
    expect(back.ballots.map((b) => [b.count, b.ranking])).toEqual([[4, [1, 0]], [1, [0, 1]]])
  })
})
