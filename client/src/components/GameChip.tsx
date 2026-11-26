import React from 'react'
import { gameLabel } from '../utils/games'
import './GameChip.css'

/** A teal chip naming the game, shown on every card and on the event page (Feature-U, UX-16). */
export const GameChip: React.FC<{ game: string }> = ({ game }) => <span className="chip chip--game">{gameLabel(game)}</span>
