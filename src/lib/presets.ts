import { makeBallot } from './ballots'
import type { Ballot, Poll } from './types'

export interface Preset {
  id: string
  label: string
  blurb: string
  poll: Poll
  ballots: Ballot[]
}

/** Builds ballots from [count, "ABCD"] groups where letters index the options in order. */
function build(prefix: string, groups: [number, string][]): Ballot[] {
  return groups.map(([count, order], k) => makeBallot(`${prefix}${k}`, [...order].map((c) => c.charCodeAt(0) - 65), count))
}

export const PRESETS: Preset[] = [
  {
    id: 'tennessee',
    label: 'Tennessee capital',
    blurb: 'The classic example: 100 voters pick a capital, and four methods give three different answers.',
    poll: { title: 'Where should Tennessee’s capital be?', options: ['Memphis', 'Nashville', 'Chattanooga', 'Knoxville'] },
    ballots: build('t', [
      [42, 'ABCD'], // Memphis > Nashville > Chattanooga > Knoxville
      [26, 'BCDA'],
      [15, 'CDBA'],
      [17, 'DCBA'],
    ]),
  },
  {
    id: 'cycle',
    label: 'Condorcet cycle',
    blurb: 'Rock-paper-scissors preferences: every option loses to another, so there is no Condorcet winner and the methods scatter.',
    poll: { title: 'Friday movie night', options: ['Comedy', 'Thriller', 'Documentary'] },
    ballots: build('c', [
      [2, 'ABC'],
      [5, 'BCA'],
      [4, 'CAB'],
      [2, 'ACB'],
    ]),
  },
  {
    id: 'pizza',
    label: 'Pizza toppings',
    blurb: 'Eleven friends, five pizzas: most methods agree, but approval voting favours the safe choice.',
    poll: { title: 'Team pizza order', options: ['Margherita', 'Pepperoni', 'Hawaiian', 'Veggie', 'Mushroom'] },
    ballots: build('p', [
      [3, 'BAEDC'],
      [2, 'BCADE'],
      [2, 'CBAED'],
      [1, 'AEDBC'],
      [1, 'DEABC'],
      [1, 'EDABC'],
      [1, 'AEBDC'],
    ]),
  },
]
