import { useState } from 'react'
import { encodePoll } from '../lib/codec'
import type { Poll } from '../lib/types'
import { copyText } from '../lib/util'

interface Props {
  poll: Poll
  valid: boolean
  base: string
  onPass: () => void
}

export function CollectTab({ poll, valid, base, onPass }: Props) {
  const [copied, setCopied] = useState(false)
  const link = `${base}#v=${encodePoll(poll)}`
  if (!valid) return <section className="card"><p className="error">Fix the poll first (see the Poll tab).</p></section>
  return (
    <div className="grid2">
      <section className="card">
        <h2>Pass the phone</h2>
        <p>Everyone ranks on this one device. Each ballot is sealed as soon as it is cast; the device only shows a count until you close the ballot box.</p>
        <button type="button" className="primary" onClick={onPass}>
          Start passing the device
        </button>
      </section>
      <section className="card">
        <h2>Share a link</h2>
        <p>Send this link to voters. They rank, get a short code, and send it back to you. You paste the codes in the Ballots tab. There is no server: the question is inside the link.</p>
        <input className="code" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Voting link" />
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={async () => {
              if (await copyText(link)) setCopied(true)
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a className="btn" href={link} target="_blank" rel="noreferrer">
            Preview as a voter
          </a>
        </div>
        <p className="muted small">Ballots are anonymous codes, but you still see them on your side. Ask voters not to share codes with each other.</p>
      </section>
    </div>
  )
}
