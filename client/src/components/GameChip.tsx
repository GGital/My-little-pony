import React from 'react'
import { gameLabel } from '../utils/games'
import { Icon } from './Icon'

/** A neutral chip (white, with a card icon) naming the game. Teal stays for seats and "registered" (UX-16, D-41). */
export const GameChip: React.FC<{ game: string }> = ({ game }) => (
  <span className="chip chip--game">
    <Icon name="card" size="sm" />
    {gameLabel(game)}
  </span>
)
