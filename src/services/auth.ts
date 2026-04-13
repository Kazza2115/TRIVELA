// ─── Auth Service (localStorage prototype) ────────────────────────────────
// Swap the functions below with Supabase / Firebase calls when going live.

export interface UserProfile {
  id: string
  email: string
  pseudo: string
  countryCode: string  // flagcdn.com code
  countryName: string
  score: number
  createdAt: number
}

interface StoredUser extends UserProfile {
  _pwKey: string  // weak obfuscation — replace with real hashing on a backend
}

const USERS_KEY   = 'trivela-users'
const SESSION_KEY = 'trivela-session'

function getStoredUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') } catch { return [] }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function weakHash(s: string) {
  // NOT secure — placeholder until a real backend is used
  return btoa(unescape(encodeURIComponent(s + '::trivela2026')))
}

// ─── Public API ────────────────────────────────────────────────────────────

export function register(
  email: string, password: string,
  pseudo: string, countryCode: string, countryName: string,
): { user?: UserProfile; error?: string } {
  const users = getStoredUsers()
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return { error: 'Cet email est déjà utilisé.' }
  if (users.find(u => u.pseudo.toLowerCase() === pseudo.toLowerCase()))
    return { error: 'Ce pseudo est déjà pris.' }
  if (pseudo.length < 2 || pseudo.length > 20)
    return { error: 'Le pseudo doit faire entre 2 et 20 caractères.' }

  const user: StoredUser = {
    id: crypto.randomUUID(), email, pseudo, countryCode, countryName,
    score: 0, createdAt: Date.now(), _pwKey: weakHash(password),
  }
  saveUsers([...users, user])
  const profile = toProfile(user)
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile))
  return { user: profile }
}

export function login(
  email: string, password: string,
): { user?: UserProfile; error?: string } {
  const users = getStoredUsers()
  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (!found) return { error: 'Email introuvable.' }
  if (found._pwKey !== weakHash(password)) return { error: 'Mot de passe incorrect.' }
  const profile = toProfile(found)
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile))
  return { user: profile }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function getSession(): UserProfile | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') } catch { return null }
}

/** Returns all users sorted by score descending. */
export function getLeaderboard(): UserProfile[] {
  return getStoredUsers()
    .map(toProfile)
    .sort((a, b) => b.score - a.score)
}

function toProfile(u: StoredUser): UserProfile {
  const { _pwKey: _, ...profile } = u
  return profile
}

// ─── Bets ──────────────────────────────────────────────────────────────────

export interface BetRecord {
  id: string
  userId: string
  matchId: string
  home: string
  away: string
  homeScore: number
  awayScore: number
  stage: string
  createdAt: number
}

const BETS_KEY = 'trivela-bets'

function getStoredBets(): BetRecord[] {
  try { return JSON.parse(localStorage.getItem(BETS_KEY) ?? '[]') } catch { return [] }
}

export function saveBet(bet: Omit<BetRecord, 'id' | 'createdAt'>): void {
  const bets = getStoredBets()
  const idx  = bets.findIndex(b => b.userId === bet.userId && b.matchId === bet.matchId)
  const record: BetRecord = { ...bet, id: crypto.randomUUID(), createdAt: Date.now() }
  if (idx >= 0) bets[idx] = record
  else bets.push(record)
  localStorage.setItem(BETS_KEY, JSON.stringify(bets))
}

export function getBets(userId: string): BetRecord[] {
  return getStoredBets()
    .filter(b => b.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
}
