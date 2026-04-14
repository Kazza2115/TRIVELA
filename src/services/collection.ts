// ─── Collection & Pack-Opening Service (localStorage prototype) ─────────────
// Manages the user's card collection, pack purchases, and album statistics.

import { PLAYERS, type Player, type Rarity } from '../data/wc2026Players'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PackType = 'starter' | 'pro' | 'superstar'

export interface PackConfig {
  type: PackType
  name: string
  price: number
  cardCount: number
  description: string
  probabilities: Record<Rarity, number>
}

export interface OwnedCard {
  playerId: string
  obtainedAt: number
  packSource: PackType
  isNew: boolean
}

export interface CollectionState {
  coins: number
  cards: OwnedCard[]
  packsOpened: number
}

// ─── Pack configurations ──────────────────────────────────────────────────────

const PACK_CONFIGS: PackConfig[] = [
  {
    type: 'starter',
    name: 'Pack Starter',
    price: 500,
    cardCount: 5,
    description: 'Un pack de base pour bien démarrer ta collection. Idéal pour les débutants !',
    probabilities: { bronze: 0.75, silver: 0.20, gold: 0.045, carnage: 0.005 },
  },
  {
    type: 'pro',
    name: 'Pack Pro',
    price: 1500,
    cardCount: 5,
    description: 'Un pack avancé avec de meilleures chances d\'obtenir des cartes rares.',
    probabilities: { bronze: 0.45, silver: 0.38, gold: 0.15, carnage: 0.02 },
  },
  {
    type: 'superstar',
    name: 'Pack Superstar',
    price: 4000,
    cardCount: 5,
    description: 'Le pack ultime ! Les meilleures chances de décrocher des cartes légendaires.',
    probabilities: { bronze: 0.25, silver: 0.40, gold: 0.30, carnage: 0.05 },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'trivela-collection'

const DEFAULT_STATE: CollectionState = {
  coins: 5000,
  cards: [],
  packsOpened: 0,
}

/**
 * Pick a random rarity based on weighted probabilities.
 */
function pickRarity(probabilities: Record<Rarity, number>): Rarity {
  const roll = Math.random()
  let cumulative = 0
  for (const rarity of ['bronze', 'silver', 'gold', 'carnage'] as Rarity[]) {
    cumulative += probabilities[rarity]
    if (roll < cumulative) return rarity
  }
  // Fallback (should not happen if probabilities sum to 1.0)
  return 'bronze'
}

/**
 * Pick a random player of a given rarity from the PLAYERS array.
 * Returns null when the player list is empty (data not yet loaded).
 */
function pickRandomPlayerByRarity(rarity: Rarity): Player | null {
  if (PLAYERS.length === 0) return null
  const pool = PLAYERS.filter(p => p.rarity === rarity)
  if (pool.length === 0) return PLAYERS[Math.floor(Math.random() * PLAYERS.length)]
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load the current collection state from localStorage.
 */
export function getCollection(): CollectionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE, cards: [] }
    return JSON.parse(raw) as CollectionState
  } catch {
    return { ...DEFAULT_STATE, cards: [] }
  }
}

/**
 * Save the collection state to localStorage.
 */
export function saveCollection(state: CollectionState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/**
 * Open a pack: deducts coins, generates 5 random cards weighted by rarity,
 * saves the updated collection, and returns the 5 new cards.
 * Returns an empty array if the user doesn't have enough coins.
 */
export function openPack(packType: PackType): OwnedCard[] {
  const config = PACK_CONFIGS.find(p => p.type === packType)
  if (!config) return []

  const state = getCollection()
  if (state.coins < config.price) return []

  const newCards: OwnedCard[] = []
  for (let i = 0; i < config.cardCount; i++) {
    const rarity = pickRarity(config.probabilities)
    const player = pickRandomPlayerByRarity(rarity)
    if (!player) continue          // no player data yet — skip card
    newCards.push({
      playerId: player.id,
      obtainedAt: Date.now(),
      packSource: packType,
      isNew: true,
    })
  }

  state.coins -= config.price
  state.cards.push(...newCards)
  state.packsOpened += 1
  saveCollection(state)

  return newCards
}

/**
 * Returns all 3 pack configurations.
 */
export function getPackConfigs(): PackConfig[] {
  return PACK_CONFIGS
}

/**
 * Mark a card as seen (isNew → false) for the first matching card.
 */
export function markCardSeen(playerId: string): void {
  const state = getCollection()
  const card = state.cards.find(c => c.playerId === playerId && c.isNew)
  if (card) {
    card.isNew = false
    saveCollection(state)
  }
}

/**
 * Get collection statistics: total players available, how many collected,
 * broken down by rarity and by team.
 */
export function getCollectionStats(): {
  total: number
  collected: number
  byRarity: Record<Rarity, { total: number; collected: number }>
  byTeam: Record<string, { total: number; collected: number }>
} {
  const state = getCollection()
  const ownedIds = new Set(state.cards.map(c => c.playerId))

  const byRarity: Record<Rarity, { total: number; collected: number }> = {
    bronze:  { total: 0, collected: 0 },
    silver:  { total: 0, collected: 0 },
    gold:    { total: 0, collected: 0 },
    carnage: { total: 0, collected: 0 },
  }

  const byTeam: Record<string, { total: number; collected: number }> = {}

  for (const player of PLAYERS) {
    // Rarity stats
    byRarity[player.rarity].total += 1
    if (ownedIds.has(player.id)) byRarity[player.rarity].collected += 1

    // Team stats
    if (!byTeam[player.teamCode]) {
      byTeam[player.teamCode] = { total: 0, collected: 0 }
    }
    byTeam[player.teamCode].total += 1
    if (ownedIds.has(player.id)) byTeam[player.teamCode].collected += 1
  }

  return {
    total: PLAYERS.length,
    collected: ownedIds.size,
    byRarity,
    byTeam,
  }
}

/**
 * Whether the user owns at least one copy of a given player.
 */
export function hasCard(playerId: string): boolean {
  return getCollection().cards.some(c => c.playerId === playerId)
}

/**
 * How many copies of a given player the user owns.
 */
export function getCardCount(playerId: string): number {
  return getCollection().cards.filter(c => c.playerId === playerId).length
}

/**
 * Returns all cards that the user owns more than one copy of (duplicates only).
 * For a player owned N times (N > 1), returns N − 1 copies (the "extra" ones).
 */
export function getDuplicates(): OwnedCard[] {
  const state = getCollection()
  const seen = new Set<string>()
  const duplicates: OwnedCard[] = []

  for (const card of state.cards) {
    if (seen.has(card.playerId)) {
      duplicates.push(card)
    } else {
      seen.add(card.playerId)
    }
  }

  return duplicates
}
