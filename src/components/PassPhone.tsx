import { useState } from 'react'
import { makeBallot } from '../lib/ballots'
import { newBallotId } from '../lib/codec'
import type { Ballot, Poll } from '../lib/types'
import { BallotForm } from './BallotForm'

interface Props {
  poll: Poll
  onCast: (b: Ballot) => void
  onFinish: () => void
}

/** Pass-the-phone mode: ballots are stored the moment they are cast and never shown until voting is closed. */
export function PassPhone({ poll, onCast, onFinish }: Props) {
  const [cast, setCast] = useState(0)
  const [voting, setVoting] = useState(false)

  return (
    <section className="card pass">
      <h2>{poll.title || 'Untitled poll'}</h2>
      {voting ? (
        <>
          <p className="badge">Voter {cast + 1}: your ballot is secret</p>
          <BallotForm
            key={cast}
            options={poll.options}
            submitLabel="Cast ballot and hide it"
            onSubmit={(ranking, scores) => {
              onCast(makeBallot(newBallotId(), ranking, 1, scores))
              setCast(cast + 1)
              setVoting(false)
            }}
          />
        </>
      ) : (
        <>
          <p className="big">{cast === 0 ? 'Hand the device to the first voter.' : `Ballot ${cast} is sealed. Hand the device to the next voter.`}</p>
          <p className="muted">Nobody can see earlier ballots from here. {cast} cast so far.</p>
          <div className="row">
            <button type="button" className="primary" onClick={() => setVoting(true)}>
              I am voter {cast + 1}, show my ballot
            </button>
            <button type="button" onClick={onFinish}>
              {cast === 0 ? 'Cancel' : 'Close the ballot box and see results'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
