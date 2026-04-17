import { supabase, supabaseConfigured } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  pseudo: string
  countryCode: string
  countryName: string
  score: number
  createdAt: number
}

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

// ─── localStorage fallback (dev / no Supabase env vars) ──────────────────────

interface StoredUser extends UserProfile { _pwKey: string }
const LS_USERS   = 'trivela-users'
const LS_SESSION = 'trivela-session'
const LS_BETS    = 'trivela-bets'

function lsUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem(LS_USERS) ?? '[]') as StoredUser[] } catch { return [] }
}
function weakHash(s: string) {
  return btoa(unescape(encodeURIComponent(s + '::trivela2026')))
}
function toProfile({ _pwKey: _, ...p }: StoredUser): UserProfile { return p }

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function register(
  email: string, password: string,
  pseudo: string, countryCode: string, countryName: string,
): Promise<{ user?: UserProfile; error?: string }> {

  if (pseudo.length < 2 || pseudo.length > 20)
    return { error: 'Le pseudo doit faire entre 2 et 20 caractères.' }

  if (supabaseConfigured && supabase) {
    const { data: existing } = await supabase
      .from('profiles').select('id').ilike('pseudo', pseudo).maybeSingle()
    if (existing) return { error: 'Ce pseudo est déjà pris.' }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { pseudo, country_code: countryCode, country_name: countryName } },
    })
    if (error) return { error: error.message }
    if (!data.user) return { error: 'Erreur lors de la création du compte.' }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id, pseudo,
      country_code: countryCode, country_name: countryName, score: 0,
    })
    if (profileError) return { error: profileError.message }

    return {
      user: {
        id: data.user.id, email,
        pseudo, countryCode, countryName,
        score: 0, createdAt: Date.now(),
      },
    }
  }

  // localStorage fallback
  const users = lsUsers()
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return { error: 'Cet email est déjà utilisé.' }
  if (users.find(u => u.pseudo.toLowerCase() === pseudo.toLowerCase()))
    return { error: 'Ce pseudo est déjà pris.' }

  const user: StoredUser = {
    id: crypto.randomUUID(), email, pseudo, countryCode, countryName,
    score: 0, createdAt: Date.now(), _pwKey: weakHash(password),
  }
  localStorage.setItem(LS_USERS, JSON.stringify([...users, user]))
  const profile = toProfile(user)
  localStorage.setItem(LS_SESSION, JSON.stringify(profile))
  return { user: profile }
}

export async function login(
  email: string, password: string,
): Promise<{ user?: UserProfile; error?: string }> {

  if (supabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (!data.user) return { error: 'Erreur de connexion.' }

    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('*').eq('id', data.user.id).single()
    if (profileError || !profile) return { error: 'Profil introuvable.' }

    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
        pseudo: profile.pseudo,
        countryCode: profile.country_code,
        countryName: profile.country_name,
        score: profile.score,
        createdAt: new Date(profile.created_at as string).getTime(),
      },
    }
  }

  // localStorage fallback
  const users = lsUsers()
  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (!found) return { error: 'Email introuvable.' }
  if (found._pwKey !== weakHash(password)) return { error: 'Mot de passe incorrect.' }
  const profile = toProfile(found)
  localStorage.setItem(LS_SESSION, JSON.stringify(profile))
  return { user: profile }
}

export async function logout(): Promise<void> {
  if (supabaseConfigured && supabase) {
    await supabase.auth.signOut()
  } else {
    localStorage.removeItem(LS_SESSION)
  }
}

type AuthCallback = (user: UserProfile | null) => void

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function subscribeToAuth(cb: AuthCallback): () => void {
  if (supabaseConfigured && supabase) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { cb(null); return }
      const { data: profile } = await supabase!
        .from('profiles').select('*').eq('id', session.user.id).single()
      if (!profile) { cb(null); return }
      cb({
        id: session.user.id,
        email: session.user.email ?? '',
        pseudo: profile.pseudo,
        countryCode: profile.country_code,
        countryName: profile.country_name,
        score: profile.score,
        createdAt: new Date(profile.created_at as string).getTime(),
      })
    })
    return () => subscription.unsubscribe()
  }

  // localStorage: read synchronously once
  try {
    const stored = localStorage.getItem(LS_SESSION)
    cb(stored ? JSON.parse(stored) as UserProfile : null)
  } catch { cb(null) }
  return () => {}
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<UserProfile[]> {
  if (supabaseConfigured && supabase) {
    const { data } = await supabase
      .from('profiles').select('*').order('score', { ascending: false })
    if (!data) return []
    return data.map(p => ({
      id: p.id as string,
      email: '',
      pseudo: p.pseudo as string,
      countryCode: p.country_code as string,
      countryName: p.country_name as string,
      score: p.score as number,
      createdAt: new Date(p.created_at as string).getTime(),
    }))
  }
  return lsUsers().map(toProfile).sort((a, b) => b.score - a.score)
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export async function saveBet(bet: Omit<BetRecord, 'id' | 'createdAt'>): Promise<void> {
  if (supabaseConfigured && supabase) {
    await supabase.from('bets').upsert({
      user_id:    bet.userId,
      match_id:   bet.matchId,
      home:       bet.home,
      away:       bet.away,
      home_score: bet.homeScore,
      away_score: bet.awayScore,
      stage:      bet.stage,
    }, { onConflict: 'user_id,match_id' })
    return
  }
  // localStorage fallback
  let bets: BetRecord[] = []
  try { bets = JSON.parse(localStorage.getItem(LS_BETS) ?? '[]') as BetRecord[] } catch {}
  const idx    = bets.findIndex(b => b.userId === bet.userId && b.matchId === bet.matchId)
  const record: BetRecord = { ...bet, id: crypto.randomUUID(), createdAt: Date.now() }
  if (idx >= 0) bets[idx] = record
  else bets.push(record)
  localStorage.setItem(LS_BETS, JSON.stringify(bets))
}

export async function getBets(userId: string): Promise<BetRecord[]> {
  if (supabaseConfigured && supabase) {
    const { data } = await supabase
      .from('bets').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (!data) return []
    return data.map(b => ({
      id:        b.id as string,
      userId:    b.user_id as string,
      matchId:   b.match_id as string,
      home:      b.home as string,
      away:      b.away as string,
      homeScore: b.home_score as number,
      awayScore: b.away_score as number,
      stage:     b.stage as string,
      createdAt: new Date(b.created_at as string).getTime(),
    }))
  }
  try {
    const bets = JSON.parse(localStorage.getItem(LS_BETS) ?? '[]') as BetRecord[]
    return bets.filter(b => b.userId === userId).sort((a, b) => b.createdAt - a.createdAt)
  } catch { return [] }
}
