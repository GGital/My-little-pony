import type { Game } from '../api/types'

/** The games by name only (X-14, Feature-U), in the order the dropdowns list them. */
export const GAME_LABELS: Record<Game, string> = {
  POKEMON: 'Pokémon TCG',
  MAGIC: 'Magic: The Gathering',
  ONE_PIECE: 'One Piece Card Game',
  YUGIOH: 'Yu-Gi-Oh!',
  DIGIMON: 'Digimon Card Game',
  LORCANA: 'Lorcana',
  OTHER: 'Other',
}
export const GAME_VALUES = Object.keys(GAME_LABELS) as Game[]
export const gameLabel = (game: string): string => GAME_LABELS[game as Game] ?? game
