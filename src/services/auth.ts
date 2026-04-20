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
  favorites: string[]
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
function toProfile({ _pwKey: _, ...p }: StoredUser): UserProfile {
  return { ...p, favorites: (p as any).favorites ?? [] }
}

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

    // Profile is created automatically by the database trigger on_auth_user_created.
    // Wait briefly for the trigger to complete before returning.
    await new Promise(r => setTimeout(r, 600))

    return {
      user: {
        id: data.user.id, email,
        pseudo, countryCode, countryName,
        score: 0, createdAt: Date.now(),
        favorites: [],
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
    score: 0, createdAt: Date.now(), favorites: [], _pwKey: weakHash(password),
  }
  localStorage.setItem(LS_USERS, JSON.stringify([...users, user]))
  const profile = toProfile(user)
  localStorage.setItem(LS_SESSION, JSON.stringify(profile))
  return { user: profile }
}

const SUPABASE_URL  = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmN3dHp6aHJzZGZ6eGlyamt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjM2MTMsImV4cCI6MjA5MTk5OTYxM30.BUfzNXfEobrz4CSeyBSj3I8To4F1eR-7AktC_kZfsO8'

export async function login(
  email: string, password: string,
): Promise<{ user?: UserProfile; error?: string }> {

  if (supabaseConfigured && supabase) {
    // Bypass the Supabase JS client entirely — it can block on internal locks
    // during initialization. Use raw fetch so the HTTP request fires immediately.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'apikey': SUPABASE_ANON,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      )
      const body = await res.json()
      if (!res.ok) {
        return { error: body.error_description || body.msg || body.message || 'Identifiants incorrects.' }
      }
      // Inject the session into the Supabase client so onAuthStateChange fires.
      if (supabase && body.access_token) {
        supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token })
          .catch(() => {}) // fire-and-forget; onAuthStateChange handles profile
      }
      const meta = body.user?.user_metadata ?? {}
      return {
        user: {
          id: body.user?.id ?? '',
          email: body.user?.email ?? email,
          pseudo: (meta.pseudo as string) ?? '',
          countryCode: (meta.country_code as string) ?? '',
          countryName: (meta.country_name as string) ?? '',
          score: 0,
          createdAt: Date.now(),
          favorites: [],
        },
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError')
        return { error: 'Connexion trop lente — vérifie ta connexion internet.' }
      return { error: 'Erreur réseau.' }
    } finally {
      clearTimeout(timer)
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
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        try {
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
            favorites: (profile.favorites as string[]) ?? [],
          })
        } catch (e) {
          console.error('[Auth] onAuthStateChange callback error:', e)
          cb(null)
        }
      })
      return () => subscription.unsubscribe()
    } catch (e) {
      console.error('[Auth] subscribeToAuth error:', e)
      cb(null)
      return () => {}
    }
  }

  // localStorage: read synchronously once
  try {
    const stored = localStorage.getItem(LS_SESSION)
    cb(stored ? JSON.parse(stored) as UserProfile : null)
  } catch { cb(null) }
  return () => {}
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export async function saveFavorites(userId: string, favorites: string[]): Promise<void> {
  if (supabaseConfigured && supabase) {
    await supabase.from('profiles').update({ favorites }).eq('id', userId)
    return
  }
  // localStorage fallback: update stored session
  try {
    const stored = localStorage.getItem(LS_SESSION)
    if (stored) {
      const profile = JSON.parse(stored) as UserProfile
      localStorage.setItem(LS_SESSION, JSON.stringify({ ...profile, favorites }))
    }
  } catch {}
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
      favorites: (p.favorites as string[]) ?? [],
    }))
  }
  return lsUsers().map(toProfile).sort((a, b) => b.score - a.score)
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export async function saveBet(bet: Omit<BetRecord, 'id' | 'createdAt'>): Promise<{ error?: string }> {
  if (supabaseConfigured && supabase) {
    const { error } = await supabase.from('bets').upsert({
      user_id:    bet.userId,
      match_id:   bet.matchId,
      home:       bet.home,
      away:       bet.away,
      home_score: bet.homeScore,
      away_score: bet.awayScore,
      stage:      bet.stage,
    }, { onConflict: 'user_id,match_id' })
    if (error) return { error: 'Pari verrouillé — modification impossible.' }
    return {}
  }
  // localStorage fallback
  let bets: BetRecord[] = []
  try { bets = JSON.parse(localStorage.getItem(LS_BETS) ?? '[]') as BetRecord[] } catch {}
  const idx    = bets.findIndex(b => b.userId === bet.userId && b.matchId === bet.matchId)
  const record: BetRecord = { ...bet, id: crypto.randomUUID(), createdAt: Date.now() }
  if (idx >= 0) bets[idx] = record
  else bets.push(record)
  localStorage.setItem(LS_BETS, JSON.stringify(bets))
  return {}
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

// ─── Real-time subscriptions ──────────────────────────────────────────────────

export interface MatchResult {
  matchId:   string
  homeScore: number
  awayScore: number
  settledAt: number
}

export function subscribeToResults(cb: (results: MatchResult[]) => void): () => void {
  if (!supabase) { cb([]); return () => {} }

  const fetchAll = async () => {
    const { data } = await supabase!.from('match_results').select('*')
    cb((data ?? []).map(r => ({
      matchId:   r.match_id   as string,
      homeScore: r.home_score as number,
      awayScore: r.away_score as number,
      settledAt: new Date(r.settled_at as string).getTime(),
    })))
  }

  fetchAll()

  const channel = supabase
    .channel('match-results-rt')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_results' }, fetchAll)
    .subscribe()

  return () => { supabase!.removeChannel(channel) }
}

export function subscribeToLeaderboard(cb: (players: UserProfile[]) => void): () => void {
  if (!supabase) {
    getLeaderboard().then(cb)
    return () => {}
  }

  getLeaderboard().then(cb)

  const channel = supabase
    .channel('profiles-rt')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
      () => getLeaderboard().then(cb)
    )
    .subscribe()

  return () => { supabase!.removeChannel(channel) }
}
