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
  isAdmin: boolean
  exactCount?: number   // nb de scores exacts (départage)
  goodCount?: number    // nb de bons résultats (départage)
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

// ─── Supabase constants ───────────────────────────────────────────────────────

const SUPA_URL  = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmN3dHp6aHJzZGZ6eGlyamt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjM2MTMsImV4cCI6MjA5MTk5OTYxM30.BUfzNXfEobrz4CSeyBSj3I8To4F1eR-7AktC_kZfsO8'
const JWT_KEY     = 'trivela-jwt'
const REFRESH_KEY = 'trivela-refresh'
const PERSIST_KEY = 'trivela-remember'

// ─── Session store — access + refresh tokens, "stay logged in" aware ─────────

let _jwt: string | null = null
let _refresh: string | null = null
let _persist = true                       // true → localStorage (longue durée), false → sessionStorage
let _refreshTimer: ReturnType<typeof setInterval> | null = null

function tokenExpMs(jwt: string): number {
  try { return (JSON.parse(atob(jwt.split('.')[1])).exp ?? 0) * 1000 } catch { return 0 }
}
function safeLocal(): Storage | null   { try { return localStorage } catch { return null } }
function safeSession(): Storage | null { try { return sessionStorage } catch { return null } }
function clearKey(k: string) { safeLocal()?.removeItem(k); safeSession()?.removeItem(k) }

// Restore tokens on module load — depuis localStorage OU sessionStorage
try {
  _persist = safeLocal()?.getItem(PERSIST_KEY) !== '0'
  const jwt = safeLocal()?.getItem(JWT_KEY) ?? safeSession()?.getItem(JWT_KEY) ?? null
  const rt  = safeLocal()?.getItem(REFRESH_KEY) ?? safeSession()?.getItem(REFRESH_KEY) ?? null
  if (rt) _refresh = rt
  if (jwt && tokenExpMs(jwt) > Date.now()) _jwt = jwt   // sinon : on renouvellera via le refresh token
} catch {}

/** Enregistre la session. `persist` true = reste connecté (localStorage). */
function persistSession(access: string | null, refresh: string | null, persist: boolean = _persist) {
  _jwt = access
  if (refresh) _refresh = refresh
  _persist = persist
  clearKey(JWT_KEY); clearKey(REFRESH_KEY)
  const s = persist ? safeLocal() : safeSession()
  try {
    if (access && s)   s.setItem(JWT_KEY, access)
    if (_refresh && s) s.setItem(REFRESH_KEY, _refresh)
    safeLocal()?.setItem(PERSIST_KEY, persist ? '1' : '0')
  } catch {}
}

function clearSession() {
  _jwt = null; _refresh = null
  clearKey(JWT_KEY); clearKey(REFRESH_KEY)
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null }
}

// Compat : ancien setJwt → met à jour l'access token sans toucher au refresh
function setJwt(token: string | null) {
  if (token === null) { clearSession(); return }
  persistSession(token, _refresh, _persist)
}

/** Échange le refresh token contre un nouvel access token. */
async function refreshSession(): Promise<boolean> {
  if (!_refresh) return false
  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPA_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: _refresh }),
    })
    if (!res.ok) return false
    const body = await res.json()
    if (!body.access_token) return false
    persistSession(body.access_token, body.refresh_token ?? _refresh, _persist)
    return true
  } catch { return false }
}

/** Garantit un access token valide (renouvelle si expiré / proche de l'expiration). */
async function ensureFreshToken(): Promise<void> {
  if (_jwt && tokenExpMs(_jwt) > Date.now() + 60_000) return
  if (_refresh) await refreshSession()
}

function startRefreshTimer() {
  if (_refreshTimer || !_refresh) return
  _refreshTimer = setInterval(() => { refreshSession() }, 45 * 60 * 1000)
}


// Authenticated REST helper — uses stored JWT, falls back to anon key
async function authFetch(method: string, path: string, body?: object): Promise<Response> {
  await ensureFreshToken()
  const headers: Record<string, string> = {
    'apikey':        SUPA_ANON,
    'Authorization': `Bearer ${_jwt ?? SUPA_ANON}`,
    'Content-Type':  'application/json',
  }
  if (method === 'POST' || method === 'PATCH') {
    headers['Prefer'] = 'resolution=merge-duplicates,return=minimal'
  }
  return fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Fetch a Supabase user's profile row via REST
async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const res = await authFetch('GET', `profiles?id=eq.${userId}&select=*`)
  if (!res.ok) return null
  const rows = await res.json()
  const p = rows[0]
  if (!p) return null
  return {
    id:          p.id,
    email:       '',
    pseudo:      p.pseudo,
    countryCode: p.country_code,
    countryName: p.country_name,
    score:       p.score,
    createdAt:   new Date(p.created_at as string).getTime(),
    favorites:   (p.favorites as string[]) ?? [],
    isAdmin:     (p.is_admin as boolean) ?? false,
  }
}

// ─── localStorage fallback (dev / no Supabase) ───────────────────────────────

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
  return { ...p, favorites: (p as any).favorites ?? [], isAdmin: (p as any).isAdmin ?? false }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function register(
  email: string, password: string,
  pseudo: string, countryCode: string, countryName: string,
  remember: boolean = true,
): Promise<{ user?: UserProfile; error?: string }> {

  if (pseudo.length < 2 || pseudo.length > 20)
    return { error: 'Le pseudo doit faire entre 2 et 20 caractères.' }

  if (supabaseConfigured) {
    // Check pseudo uniqueness
    const check = await fetch(
      `${SUPA_URL}/rest/v1/profiles?pseudo=ilike.${encodeURIComponent(pseudo)}&select=id&limit=1`,
      { headers: { 'apikey': SUPA_ANON, 'Authorization': `Bearer ${SUPA_ANON}` } }
    )
    const existing = await check.json()
    if (existing?.length > 0) return { error: 'Ce pseudo est déjà pris.' }

    const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': SUPA_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, password,
        data: { pseudo, country_code: countryCode, country_name: countryName },
      }),
    })
    const body = await res.json()
    if (!res.ok || body.error) return { error: body.error_description || body.msg || body.message || 'Erreur inscription.' }
    if (!body.user) return { error: 'Erreur lors de la création du compte.' }

    if (body.access_token) {
      persistSession(body.access_token, body.refresh_token ?? null, remember)
      startRefreshTimer()
    }

    await new Promise(r => setTimeout(r, 800))

    return {
      user: {
        id: body.user.id, email,
        pseudo, countryCode, countryName,
        score: 0, createdAt: Date.now(),
        favorites: [], isAdmin: false,
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
    score: 0, createdAt: Date.now(), favorites: [], isAdmin: false, _pwKey: weakHash(password),
  }
  localStorage.setItem(LS_USERS, JSON.stringify([...users, user]))
  const profile = toProfile(user)
  localStorage.setItem(LS_SESSION, JSON.stringify(profile))
  return { user: profile }
}

export async function login(
  email: string, password: string, remember: boolean = true,
): Promise<{ user?: UserProfile; error?: string }> {

  if (supabaseConfigured) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'apikey': SUPA_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json()
      if (!res.ok) return { error: body.error_description || body.msg || body.message || 'Identifiants incorrects.' }

      persistSession(body.access_token, body.refresh_token ?? null, remember)
      startRefreshTimer()

      // Fetch full profile now that JWT is stored
      const profile = await fetchProfile(body.user?.id)
      return {
        user: profile ?? {
          id: body.user?.id ?? '',
          email: body.user?.email ?? email,
          pseudo: (body.user?.user_metadata?.pseudo as string) ?? '',
          countryCode: (body.user?.user_metadata?.country_code as string) ?? '',
          countryName: (body.user?.user_metadata?.country_name as string) ?? '',
          score: 0, createdAt: Date.now(), favorites: [], isAdmin: false,
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
  const token = _jwt
  setJwt(null)
  try { localStorage.removeItem(LS_SESSION) } catch {}
  try { localStorage.removeItem('sb-tivcwtzzhrsdfzxirjkw-auth-token') } catch {}
  if (token) {
    fetch(`${SUPA_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { 'apikey': SUPA_ANON, 'Authorization': `Bearer ${token}` },
    }).catch(() => {})
  }
}

type AuthCallback = (user: UserProfile | null) => void

export function subscribeToAuth(cb: AuthCallback): () => void {
  if (supabaseConfigured) {
    ;(async () => {
      await ensureFreshToken()              // renouvelle via le refresh token si l'accès a expiré
      if (!_jwt) { cb(null); return }
      const fetchUser = () => fetch(`${SUPA_URL}/auth/v1/user`, {
        headers: { 'apikey': SUPA_ANON, 'Authorization': `Bearer ${_jwt}` },
      })
      try {
        let r = await fetchUser()
        if (!r.ok && await refreshSession()) r = await fetchUser()   // 401 → un essai de renouvellement
        if (!r.ok) { clearSession(); cb(null); return }
        const user = await r.json()
        if (!user?.id) { clearSession(); cb(null); return }
        const profile = await fetchProfile(user.id)
        if (profile) { profile.email = user.email ?? ''; startRefreshTimer(); cb(profile) }
        else cb(null)
      } catch { cb(null) }
    })()
    return () => {}
  }

  // localStorage fallback
  try {
    const stored = localStorage.getItem(LS_SESSION)
    cb(stored ? JSON.parse(stored) as UserProfile : null)
  } catch { cb(null) }
  return () => {}
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export async function saveFavorites(userId: string, favorites: string[]): Promise<void> {
  if (supabaseConfigured) {
    await authFetch('PATCH', `profiles?id=eq.${userId}`, { favorites })
    return
  }
  try {
    const stored = localStorage.getItem(LS_SESSION)
    if (stored) {
      const profile = JSON.parse(stored) as UserProfile
      localStorage.setItem(LS_SESSION, JSON.stringify({ ...profile, favorites }))
    }
  } catch {}
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

// Départage : score → nb de scores exacts → nb de bons résultats → pseudo (A→Z).
function byScoreThenTiebreak(a: UserProfile, b: UserProfile): number {
  return (b.score - a.score)
    || ((b.exactCount ?? 0) - (a.exactCount ?? 0))
    || ((b.goodCount ?? 0) - (a.goodCount ?? 0))
    || a.pseudo.localeCompare(b.pseudo, 'fr', { sensitivity: 'base' })
}

function rowToProfile(p: any): UserProfile {
  return {
    id: p.id as string, email: '',
    pseudo: p.pseudo as string,
    countryCode: p.country_code as string,
    countryName: p.country_name as string,
    score: (p.score as number) ?? 0,
    createdAt: new Date(p.created_at as string).getTime(),
    favorites: (p.favorites as string[]) ?? [],
    isAdmin: (p.is_admin as boolean) ?? false,
    exactCount: Number(p.exact_count ?? 0),
    goodCount: Number(p.good_count ?? 0),
  }
}

export async function getLeaderboard(): Promise<UserProfile[]> {
  if (supabaseConfigured && supabase) {
    // Fonction d'agrégation (score + scores exacts + bons résultats pour le départage).
    const { data, error } = await supabase.rpc('leaderboard')
    if (!error && Array.isArray(data)) {
      return data.map(rowToProfile).sort(byScoreThenTiebreak)
    }
    // Repli si la fonction SQL n'est pas encore créée : classement par score seul.
    const { data: prof } = await supabase
      .from('profiles').select('*').order('score', { ascending: false })
    if (!prof) return []
    return prof.map(rowToProfile).sort(byScoreThenTiebreak)
  }
  return lsUsers().map(toProfile).sort(byScoreThenTiebreak)
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export async function saveBet(bet: Omit<BetRecord, 'id' | 'createdAt'>): Promise<{ error?: string }> {
  if (supabaseConfigured) {
    const res = await authFetch('POST', 'bets', {
      user_id:    bet.userId,
      match_id:   bet.matchId,
      home:       bet.home,
      away:       bet.away,
      home_score: bet.homeScore,
      away_score: bet.awayScore,
      stage:      bet.stage,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      // locked = bet already exists and match is locked
      if (res.status === 409 || (err as any)?.code === '23505') {
        // Try UPDATE if not locked
        const upd = await authFetch('PATCH', `bets?user_id=eq.${bet.userId}&match_id=eq.${bet.matchId}&locked=eq.false`, {
          home_score: bet.homeScore,
          away_score: bet.awayScore,
        })
        if (!upd.ok) return { error: 'Pari verrouillé — modification impossible.' }
        return {}
      }
      return { error: 'Erreur lors de l\'enregistrement du pari.' }
    }
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
  if (supabaseConfigured) {
    const res = await authFetch('GET', `bets?user_id=eq.${userId}&order=created_at.desc&select=*`)
    if (!res.ok) return []
    const data = await res.json()
    return (data as any[]).map(b => ({
      id:        b.id        as string,
      userId:    b.user_id   as string,
      matchId:   b.match_id  as string,
      home:      b.home      as string,
      away:      b.away      as string,
      homeScore: b.home_score as number,
      awayScore: b.away_score as number,
      stage:     b.stage     as string,
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
    .channel(`match-results-rt-${Math.random().toString(36).slice(2)}`)
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
    .channel(`profiles-rt-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
      () => getLeaderboard().then(cb)
    )
    .subscribe()

  return () => { supabase!.removeChannel(channel) }
}

// ─── Social : pronostics publics, notes & commentaires ──────────────────────

/** Pari d'un joueur tel que vu par les autres. Le score n'est dévoilé qu'au
 *  coup d'envoi (revealed=true) — la vue public_bets le masque sinon. */
export interface PublicBet {
  id:        string
  userId:    string
  matchId:   string
  home:      string
  away:      string
  stage:     string
  homeScore: number | null
  awayScore: number | null
  points:    number | null
  locked:    boolean
  revealed:  boolean
  createdAt: number
}

export async function getPublicBets(userId: string): Promise<PublicBet[]> {
  if (!supabaseConfigured) return []
  const res = await authFetch('GET', `public_bets?user_id=eq.${userId}&order=created_at.desc&select=*`)
  if (!res.ok) return []
  const data = await res.json()
  return (data as any[]).map(b => ({
    id:        b.id         as string,
    userId:    b.user_id    as string,
    matchId:   b.match_id   as string,
    home:      b.home       as string,
    away:      b.away       as string,
    stage:     b.stage      as string,
    homeScore: b.home_score as number | null,
    awayScore: b.away_score as number | null,
    points:    b.points     as number | null,
    locked:    b.locked     as boolean,
    revealed:  b.revealed   as boolean,
    createdAt: new Date(b.created_at as string).getTime(),
  }))
}

export async function getResults(): Promise<MatchResult[]> {
  if (!supabase) return []
  const { data } = await supabase.from('match_results').select('*')
  return (data ?? []).map(r => ({
    matchId:   r.match_id   as string,
    homeScore: r.home_score as number,
    awayScore: r.away_score as number,
    settledAt: new Date(r.settled_at as string).getTime(),
  }))
}

// ── Notes (1–5 ⭐) ────────────────────────────────────────────────────────────
export interface BetRating { matchId: string; raterId: string; rating: number }

export async function getRatings(targetUserId: string): Promise<BetRating[]> {
  if (!supabaseConfigured) return []
  const res = await authFetch('GET', `bet_ratings?target_user_id=eq.${targetUserId}&select=match_id,rater_id,rating`)
  if (!res.ok) return []
  return (await res.json() as any[]).map(r => ({
    matchId: r.match_id as string, raterId: r.rater_id as string, rating: r.rating as number,
  }))
}

/** Note (ou re-note) le pronostic d'un joueur sur un match. Upsert via la
 *  contrainte unique (Prefer: resolution=merge-duplicates dans authFetch). */
export async function rateBet(
  targetUserId: string, matchId: string, raterId: string, rating: number,
): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  // on_conflict cible la contrainte unique métier (et non la PK id), pour que
  // re-noter mette à jour la ligne existante au lieu d'échouer.
  const res = await authFetch('POST', 'bet_ratings?on_conflict=match_id,target_user_id,rater_id', {
    target_user_id: targetUserId, match_id: matchId, rater_id: raterId, rating,
  })
  if (res.ok) return {}
  const detail = await res.text().catch(() => '')
  return { error: `Note refusée (${res.status}). ${detail}`.trim() }
}

// ── Commentaires ──────────────────────────────────────────────────────────────
export interface BetComment {
  id: string; matchId: string; authorId: string; authorPseudo: string; body: string; createdAt: number
}

export async function getComments(targetUserId: string): Promise<BetComment[]> {
  if (!supabaseConfigured) return []
  const res = await authFetch('GET', `bet_comments?target_user_id=eq.${targetUserId}&order=created_at.asc&select=*`)
  if (!res.ok) return []
  return (await res.json() as any[]).map(c => ({
    id: c.id as string, matchId: c.match_id as string,
    authorId: c.author_id as string, authorPseudo: c.author_pseudo as string,
    body: c.body as string, createdAt: new Date(c.created_at as string).getTime(),
  }))
}

export async function addComment(
  targetUserId: string, matchId: string, authorId: string, authorPseudo: string, body: string,
): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  const text = body.trim()
  if (text.length < 1 || text.length > 280) return { error: 'Commentaire vide ou trop long (280 max).' }
  const res = await authFetch('POST', 'bet_comments', {
    target_user_id: targetUserId, match_id: matchId,
    author_id: authorId, author_pseudo: authorPseudo, body: text,
  })
  return res.ok ? {} : { error: 'Impossible d\'envoyer le commentaire.' }
}

export async function deleteComment(id: string): Promise<void> {
  if (!supabaseConfigured) return
  await authFetch('DELETE', `bet_comments?id=eq.${id}`)
}

// ── Réactions aux commentaires (👍 / 👎) ──────────────────────────────────────
export interface CommentReaction { commentId: string; userId: string; value: number }

export async function getCommentReactions(commentIds: string[]): Promise<CommentReaction[]> {
  if (!supabaseConfigured || commentIds.length === 0) return []
  const list = commentIds.join(',')
  const res = await authFetch('GET', `comment_reactions?comment_id=in.(${list})&select=comment_id,user_id,value`)
  if (!res.ok) return []
  return (await res.json() as any[]).map(r => ({
    commentId: r.comment_id as string, userId: r.user_id as string, value: r.value as number,
  }))
}

/** Pose ou met à jour une réaction (value = 1 pour like, -1 pour dislike). */
export async function reactToComment(
  commentId: string, userId: string, value: 1 | -1,
): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  const res = await authFetch('POST', 'comment_reactions?on_conflict=comment_id,user_id', {
    comment_id: commentId, user_id: userId, value,
  })
  if (res.ok) return {}
  const detail = await res.text().catch(() => '')
  return { error: `Réaction refusée (${res.status}). ${detail}`.trim() }
}

export async function unreactToComment(commentId: string, userId: string): Promise<void> {
  if (!supabaseConfigured) return
  await authFetch('DELETE', `comment_reactions?comment_id=eq.${commentId}&user_id=eq.${userId}`)
}

/** Notifie à chaque note/commentaire/réaction sur les pronostics d'un joueur. */
export function subscribeToPlayerSocial(targetUserId: string, cb: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`social-${targetUserId}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_comments', filter: `target_user_id=eq.${targetUserId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_ratings',  filter: `target_user_id=eq.${targetUserId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_reactions' }, cb)
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
}

// ── Boîte de réception / notifications ───────────────────────────────────────
export interface AppNotification {
  id: string
  type: 'comment' | 'rating' | 'mention'
  actorPseudo: string
  matchId: string | null
  body: string | null
  read: boolean
  createdAt: number
}

function mapNotification(n: any): AppNotification {
  return {
    id: n.id as string,
    type: (n.type as AppNotification['type']) ?? 'comment',
    actorPseudo: (n.actor_pseudo as string) ?? '',
    matchId: (n.match_id as string) ?? null,
    body: (n.body as string) ?? null,
    read: !!n.read,
    createdAt: new Date(n.created_at as string).getTime(),
  }
}

export async function getNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  if (!supabaseConfigured) return []
  const res = await authFetch('GET', `notifications?user_id=eq.${userId}&order=created_at.desc&limit=${limit}`)
  if (!res.ok) return []
  return (await res.json() as any[]).map(mapNotification)
}

/** Marque toutes les notifications non lues du joueur comme lues. */
export async function markNotificationsRead(userId: string): Promise<void> {
  if (!supabaseConfigured) return
  await authFetch('PATCH', `notifications?user_id=eq.${userId}&read=eq.false`, { read: true })
}

/** Réagit en temps réel à toute nouvelle notification du joueur. */
export function subscribeToNotifications(userId: string, cb: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`notif-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, cb)
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
}

// ── Chat global en direct ────────────────────────────────────────────────────
export interface ChatMessage {
  id: string; userId: string; pseudo: string; countryCode: string; body: string; createdAt: number
}

export async function getChatMessages(limit = 100): Promise<ChatMessage[]> {
  if (!supabaseConfigured) return []
  const res = await authFetch('GET', `chat_messages?order=created_at.desc&limit=${limit}&select=*`)
  if (!res.ok) return []
  const rows = (await res.json() as any[]).map(m => ({
    id: m.id as string, userId: m.user_id as string, pseudo: m.pseudo as string,
    countryCode: (m.country_code as string) ?? 'un', body: m.body as string,
    createdAt: new Date(m.created_at as string).getTime(),
  }))
  return rows.reverse() // ordre chronologique (plus ancien → plus récent)
}

export async function sendChatMessage(
  userId: string, pseudo: string, countryCode: string, body: string,
): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  const text = body.trim()
  if (text.length < 1 || text.length > 500) return { error: 'Message vide ou trop long (500 max).' }
  const res = await authFetch('POST', 'chat_messages', {
    user_id: userId, pseudo, country_code: countryCode, body: text,
  })
  if (res.ok) return {}
  const detail = await res.text().catch(() => '')
  return { error: `Envoi refusé (${res.status}). ${detail}`.trim() }
}

export async function deleteChatMessage(id: string): Promise<void> {
  if (!supabaseConfigured) return
  await authFetch('DELETE', `chat_messages?id=eq.${id}`)
}

/** Notifie à chaque nouveau message (ou suppression) du chat global. */
export function subscribeToChat(cb: () => void): () => void {
  if (!supabase) return () => {}
  // Nom de canal unique : plusieurs composants (aperçu + panneau) peuvent
  // s'abonner en même temps sans entrer en collision sur le même canal.
  const channel = supabase
    .channel(`chat-rt-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, cb)
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
}

// ── Édition du profil (pseudo / pays / e-mail / mot de passe) ─────────────────

// Fetch sur l'endpoint GoTrue (compte), distinct du REST PostgREST.
async function authUserFetch(method: string, body?: object): Promise<Response> {
  return fetch(`${SUPA_URL}/auth/v1/user`, {
    method,
    headers: {
      'apikey': SUPA_ANON,
      'Authorization': `Bearer ${_jwt ?? SUPA_ANON}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/** Récupère l'e-mail réel du compte connecté (non stocké dans profiles). */
export async function getAuthEmail(): Promise<string> {
  if (!supabaseConfigured) {
    try { return (JSON.parse(localStorage.getItem(LS_SESSION) ?? '{}').email as string) ?? '' } catch { return '' }
  }
  const res = await authUserFetch('GET')
  if (!res.ok) return ''
  const u = await res.json().catch(() => ({}))
  return (u?.email as string) ?? ''
}

/** Met à jour pseudo + pays (vérifie l'unicité du pseudo, hors soi-même). */
export async function updateProfileInfo(
  userId: string, pseudo: string, countryCode: string, countryName: string,
): Promise<{ error?: string }> {
  const name = pseudo.trim()
  if (name.length < 2 || name.length > 20) return { error: 'Le pseudo doit faire entre 2 et 20 caractères.' }
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }

  const check = await authFetch('GET',
    `profiles?pseudo=ilike.${encodeURIComponent(name)}&id=neq.${userId}&select=id&limit=1`)
  const existing = await check.json().catch(() => [])
  if (Array.isArray(existing) && existing.length > 0) return { error: 'Ce pseudo est déjà pris.' }

  const res = await authFetch('PATCH', `profiles?id=eq.${userId}`, {
    pseudo: name, country_code: countryCode, country_name: countryName,
  })
  return res.ok ? {} : { error: 'Échec de la mise à jour du profil.' }
}

/** Change l'adresse e-mail du compte (peut nécessiter une confirmation par mail). */
export async function updateEmail(email: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  const res = await authUserFetch('PUT', { email: email.trim() })
  if (res.ok) return {}
  const b = await res.json().catch(() => ({}))
  return { error: b.error_description || b.msg || b.message || 'Échec de la mise à jour de l\'e-mail.' }
}

/** Change le mot de passe du compte. */
export async function updatePassword(password: string): Promise<{ error?: string }> {
  if (password.length < 6) return { error: 'Le mot de passe doit faire au moins 6 caractères.' }
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  const res = await authUserFetch('PUT', { password })
  if (res.ok) return {}
  const b = await res.json().catch(() => ({}))
  return { error: b.error_description || b.msg || b.message || 'Échec de la mise à jour du mot de passe.' }
}

// ── Récupération de mot de passe (e-mail Supabase / GoTrue) ───────────────────

/** Envoie un e-mail de réinitialisation contenant un lien de retour vers l'app. */
export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  const addr = email.trim()
  if (!addr) return { error: 'Entrez votre adresse e-mail.' }
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  try {
    const redirectTo = `${window.location.origin}/`
    const res = await fetch(
      `${SUPA_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: 'POST',
        headers: { 'apikey': SUPA_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addr }),
      },
    )
    if (res.ok) return {}
    const b = await res.json().catch(() => ({}))
    return { error: b.error_description || b.msg || b.message || 'Envoi impossible — réessaie.' }
  } catch {
    return { error: 'Erreur réseau — réessaie.' }
  }
}

/** À l'ouverture de l'app : détecte un lien de récupération dans l'URL (#type=recovery…).
 *  Si présent, installe la session de récupération et renvoie { active: true }. */
export function beginPasswordRecovery(): { active: boolean; error?: string } {
  if (!supabaseConfigured) return { active: false }
  try {
    const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    if (!raw) return { active: false }
    const p = new URLSearchParams(raw)
    const clean = () => {
      try { history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* ignore */ }
    }
    if (p.get('error') || p.get('error_description')) {
      clean()
      return { active: false, error: p.get('error_description') || 'Lien invalide ou expiré.' }
    }
    if (p.get('type') === 'recovery' && p.get('access_token')) {
      persistSession(p.get('access_token'), p.get('refresh_token'), true)
      startRefreshTimer()
      clean()
      return { active: true }
    }
  } catch { /* ignore */ }
  return { active: false }
}

// ── Administration ───────────────────────────────────────────────────────────

/** Promeut (true) ou rétrograde (false) un joueur en admin. Réservé aux admins. */
export async function setUserAdmin(targetId: string, value: boolean): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  const res = await authFetch('POST', 'rpc/admin_set_admin', { p_target: targetId, p_value: value })
  if (res.ok) return {}
  const detail = await res.text().catch(() => '')
  return { error: `Action refusée (${res.status}). ${detail}`.trim() }
}

/** Supprime définitivement un profil (et son compte). Réservé aux admins. */
export async function deleteUserProfile(targetId: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  const res = await authFetch('POST', 'rpc/admin_delete_profile', { p_target: targetId })
  if (res.ok) return {}
  const detail = await res.text().catch(() => '')
  return { error: `Suppression refusée (${res.status}). ${detail}`.trim() }
}

/** Supprime tous les messages du chat. Réservé aux admins. */
export async function clearChat(): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  const res = await authFetch('POST', 'rpc/admin_clear_chat', {})
  if (res.ok) return {}
  const detail = await res.text().catch(() => '')
  return { error: `Action refusée (${res.status}). ${detail}`.trim() }
}

/** Liste des identifiants des joueurs admin (pour styliser le chat). */
export async function getAdminIds(): Promise<string[]> {
  if (!supabaseConfigured) return []
  const res = await authFetch('GET', 'profiles?is_admin=eq.true&select=id')
  if (!res.ok) return []
  return (await res.json() as any[]).map(r => r.id as string)
}

// ── Présence en ligne (Realtime Presence) ────────────────────────────────────
export interface PresenceUser { id: string; pseudo: string; countryCode: string }

export function subscribeToPresence(
  me: { id: string; pseudo: string; countryCode: string } | null,
  cb: (users: PresenceUser[]) => void,
): () => void {
  if (!supabase) return () => {}
  const key = me?.id ?? `anon-${Math.random().toString(36).slice(2)}`
  const channel = supabase.channel('online', { config: { presence: { key } } })
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState() as Record<string, any[]>
    const seen = new Map<string, PresenceUser>()
    for (const arr of Object.values(state)) {
      for (const p of arr) {
        if (p?.id) seen.set(p.id, { id: p.id, pseudo: p.pseudo ?? '', countryCode: p.countryCode ?? 'un' })
      }
    }
    cb([...seen.values()])
  })
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED' && me) {
      await channel.track({ id: me.id, pseudo: me.pseudo, countryCode: me.countryCode })
    }
  })
  return () => { supabase!.removeChannel(channel) }
}

/** Liste des joueurs (pseudo + drapeau) pour l'autocomplétion des mentions @. */
export async function getMentionables(): Promise<{ id: string; pseudo: string; countryCode: string }[]> {
  if (!supabaseConfigured) return []
  const res = await authFetch('GET', 'profiles?select=id,pseudo,country_code&order=pseudo.asc&limit=300')
  if (!res.ok) return []
  return (await res.json() as any[]).map(p => ({
    id: p.id as string, pseudo: p.pseudo as string, countryCode: (p.country_code as string) ?? 'un',
  }))
}

/** Reçoit chaque NOUVEAU message du chat (pour détecter les mentions). */
export function subscribeToNewMessages(cb: (m: ChatMessage) => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`chat-new-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
      const r = payload.new as any
      cb({
        id: r.id as string, userId: r.user_id as string, pseudo: r.pseudo as string,
        countryCode: (r.country_code as string) ?? 'un', body: r.body as string,
        createdAt: new Date(r.created_at as string).getTime(),
      })
    })
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
}

// ── Accusés de lecture du chat (« vu par ») ──────────────────────────────────
export interface ChatRead { userId: string; pseudo: string; countryCode: string; lastRead: number }

export async function getChatReads(): Promise<ChatRead[]> {
  if (!supabaseConfigured) return []
  const res = await authFetch('GET', 'chat_reads?select=user_id,pseudo,country_code,last_read')
  if (!res.ok) return []
  return (await res.json() as any[]).map(r => ({
    userId: r.user_id as string, pseudo: r.pseudo as string,
    countryCode: (r.country_code as string) ?? 'un',
    lastRead: new Date(r.last_read as string).getTime(),
  }))
}

/** Marque le chat comme lu jusqu'à maintenant pour l'utilisateur courant. */
export async function markChatRead(userId: string, pseudo: string, countryCode: string): Promise<void> {
  if (!supabaseConfigured) return
  await authFetch('POST', 'chat_reads?on_conflict=user_id', {
    user_id: userId, pseudo, country_code: countryCode, last_read: new Date().toISOString(),
  })
}

export function subscribeToChatReads(cb: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`chat-reads-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reads' }, cb)
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
}

// ── Scores en direct (table match_live, alimentée par API-Football) ──────────
export interface LiveScore {
  matchId: string; status: string; elapsed: number | null
  homeScore: number; awayScore: number
}

export async function getLive(): Promise<LiveScore[]> {
  if (!supabaseConfigured) return []
  const res = await authFetch('GET', 'match_live?select=*')
  if (!res.ok) return []
  return (await res.json() as any[]).map(r => ({
    matchId: r.match_id as string, status: r.status as string,
    elapsed: (r.elapsed as number) ?? null,
    homeScore: (r.home_score as number) ?? 0, awayScore: (r.away_score as number) ?? 0,
  }))
}

export function subscribeToLive(cb: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`live-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_live' }, cb)
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
}

// ─── Buteurs (match_goals) ──────────────────────────────────────────────────
export interface Scorer {
  player: string
  side: 'home' | 'away'
  minute: number | null
  og: boolean
  pen: boolean
}

export async function getMatchGoals(): Promise<Record<string, Scorer[]>> {
  if (!supabaseConfigured) return {}
  const res = await authFetch('GET', 'match_goals?select=*')
  if (!res.ok) return {}
  const map: Record<string, Scorer[]> = {}
  for (const r of (await res.json() as any[])) {
    const arr = Array.isArray(r.scorers) ? r.scorers : []
    map[r.match_id as string] = arr.map((s: any) => ({
      player: String(s.p ?? '?'),
      side: s.s === 'away' ? 'away' : 'home',
      minute: typeof s.t === 'number' ? s.t : null,
      og: !!s.og,
      pen: !!s.pen,
    }))
  }
  return map
}

// ─── Cartons rouges (match_goals.cards) ─────────────────────────────────────
export interface RedCard {
  player: string
  side: 'home' | 'away'
  minute: number | null
}

export async function getMatchCards(): Promise<Record<string, RedCard[]>> {
  if (!supabaseConfigured) return {}
  const res = await authFetch('GET', 'match_goals?select=match_id,cards')
  if (!res.ok) return {}   // colonne 'cards' absente (migration non lancée) → aucun carton
  const map: Record<string, RedCard[]> = {}
  for (const r of (await res.json() as any[])) {
    const arr = Array.isArray(r.cards) ? r.cards : []
    map[r.match_id as string] = arr.map((c: any) => ({
      player: String(c.p ?? '?'),
      side: c.s === 'away' ? 'away' : 'home',
      minute: typeof c.t === 'number' ? c.t : null,
    }))
  }
  return map
}

export function subscribeToMatchGoals(cb: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`goals-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_goals' }, cb)
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
}
