import { useState } from 'react'
import { makeBallot } from '../lib/ballots'
import { encodeBallot, newBallotId } from '../lib/codec'
import type { Poll } from '../lib/types'
import { copyText } from '../lib/util'
import { BallotForm } from './BallotForm'

/** What a voter sees when opening a shared poll link: a ballot and a code to send back. */
export function VoterView({ poll, base }: { poll: Poll; base: string }) {
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState('')
  const link = code ? `${base}#b=${code}` : ''
  const copy = async (what: string, text: string) => {
    if (await copyText(text)) setCopied(what)
  }
  return (
    <main className="app narrow">
      <header className="top">
        <h1>{poll.title || 'Group vote'}</h1>
        <p className="muted">You were invited to vote. Nothing is uploaded: your ballot becomes a short code that you send back to whoever asked.</p>
      </header>
      <section className="card">
        {code === null ? (
          <BallotForm
            options={poll.options}
            submitLabel="Create my ballot code"
            onSubmit={(ranking, scores) => setCode(encodeBallot(makeBallot(newBallotId(), ranking, 1, scores), poll))}
          />
        ) : (
          <>
            <h2>Your ballot code</h2>
            <p>Send this to the organiser (chat, email, anything):</p>
            <input className="code" readOnly value={code} onFocus={(e) => e.target.select()} aria-label="Ballot code" />
            <div className="row">
              <button type="button" className="primary" onClick={() => copy('code', code)}>
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </button>
              <button type="button" onClick={() => copy('link', link)}>
                {copied === 'link' ? 'Copied' : 'Copy as link'}
              </button>
            </div>
            <p className="muted small">The same code can be pasted only once, so sending it twice does not count twice.</p>
          </>
        )}
      </section>
      <p className="muted small">
        <a href={base}>Make your own poll</a>
      </p>
    </main>
  )
}
