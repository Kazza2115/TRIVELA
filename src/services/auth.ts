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
const JWT_KEY   = 'trivela-jwt'

// ─── JWT store — bypasses Supabase JS client lock issues ─────────────────────

let _jwt: string | null = null

// Restore JWT on module load (page reload)
try {
  const raw = localStorage.getItem(JWT_KEY)
  if (raw) {
    const exp: number = JSON.parse(atob(raw.split('.')[1])).exp ?? 0
    if (exp * 1000 > Date.now()) _jwt = raw
    else localStorage.removeItem(JWT_KEY)
  }
} catch {}

function setJwt(token: string | null) {
  _jwt = token
  try {
    if (token) localStorage.setItem(JWT_KEY, token)
    else localStorage.removeItem(JWT_KEY)
  } catch {}
}

// Authenticated REST helper — uses stored JWT, falls back to anon key
async function authFetch(method: string, path: string, body?: object): Promise<Response> {
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

    if (body.access_token) setJwt(body.access_token)

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
  email: string, password: string,
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

      setJwt(body.access_token)

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
    if (_jwt) {
      // JWT restored from localStorage — fetch the profile
      fetch(`${SUPA_URL}/auth/v1/user`, {
        headers: { 'apikey': SUPA_ANON, 'Authorization': `Bearer ${_jwt}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(async user => {
          if (!user?.id) { setJwt(null); cb(null); return }
          const profile = await fetchProfile(user.id)
          if (profile) { profile.email = user.email ?? ''; cb(profile) }
          else cb(null)
        })
        .catch(() => cb(null))
    } else {
      cb(null)
    }
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

export async function getLeaderboard(): Promise<UserProfile[]> {
  if (supabaseConfigured && supabase) {
    const { data } = await supabase
      .from('profiles').select('*').order('score', { ascending: false })
    if (!data) return []
    return data.map(p => ({
      id: p.id as string, email: '',
      pseudo: p.pseudo as string,
      countryCode: p.country_code as string,
      countryName: p.country_name as string,
      score: p.score as number,
      createdAt: new Date(p.created_at as string).getTime(),
      favorites: (p.favorites as string[]) ?? [],
      isAdmin: (p.is_admin as boolean) ?? false,
    }))
  }
  return lsUsers().map(toProfile).sort((a, b) => b.score - a.score)
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
    .channel(`social-${targetUserId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_comments', filter: `target_user_id=eq.${targetUserId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_ratings',  filter: `target_user_id=eq.${targetUserId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_reactions' }, cb)
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

// ── Administration ───────────────────────────────────────────────────────────

/** Promeut (true) ou rétrograde (false) un joueur en admin. Réservé aux admins. */
export async function setUserAdmin(targetId: string, value: boolean): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: 'Indisponible hors-ligne.' }
  const res = await authFetch('POST', 'rpc/admin_set_admin', { p_target: targetId, p_value: value })
  if (res.ok) return {}
  const detail = await res.text().catch(() => '')
  return { error: `Action refusée (${res.status}). ${detail}`.trim() }
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
