// ─── WC 2026 — Player types & stubs ──────────────────────────────────────────
// Types are used by MonAlbum & collection service.
// Player data will be populated in a later update.

export type Rarity   = 'bronze' | 'silver' | 'gold' | 'carnage'
export type Position = 'GK' | 'DEF' | 'MID' | 'ATT'

export interface Player {
  id:       string
  name:     string
  teamCode: string
  position: Position
  rarity:   Rarity
  rating:   number
  age:      number
  trait:    string
}

// ─── Player list (to be filled in) ────────────────────────────────────────────
export const PLAYERS: Player[] = []

// ─── Derived lookups ───────────────────────────────────────────────────────────
export const PLAYERS_BY_TEAM: Record<string, Player[]> = PLAYERS.reduce(
  (acc, p) => { (acc[p.teamCode] ??= []).push(p); return acc },
  {} as Record<string, Player[]>
)

export const CARNAGE_PLAYERS = PLAYERS.filter(p => p.rarity === 'carnage')
