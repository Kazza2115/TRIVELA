// Mapping partagé : fixtures API-Football (ligue 1, saison 2026) ↔ nos match_id.

// ── Fenêtres d'activité (protection du quota API) ───────────────────────────
// Un poller ne doit appeler l'API football QUE si un match est dans sa fenêtre.
// Fenêtres exprimées en millisecondes à partir du coup d'envoi (kickoff).
export const LIVE_PREROLL_MS  = 5 * 60 * 1000        // on suit dès 5 min avant le coup d'envoi
export const LIVE_MAX_MS      = 210 * 60 * 1000      // jusqu'à 3 h 30 après (couvre arrêts de jeu LONGS + prolongations + tirs au but)
export const RESULTS_MAX_MS   = 4 * 60 * 60 * 1000   // règlements + buteurs : jusqu'à 4 h après le coup d'envoi
export const SETTLE_GRACE_MS  = 15 * 60 * 1000       // on continue de suivre 15 min APRÈS le règlement (vérif du score final)

/**
 * Vrai si au moins un match du planning est MAINTENANT dans sa fenêtre.
 * @param schedule  lignes match_schedule : [{ match_id, kickoff }]
 * @param prerollMs marge avant le coup d'envoi
 * @param maxMs     durée de la fenêtre après le coup d'envoi
 */
export function anyMatchInWindow(schedule, prerollMs, maxMs, now = Date.now()) {
  return (schedule || []).some(s => {
    const k = Date.parse(s.kickoff)
    return Number.isFinite(k) && now >= k - prerollMs && now <= k + maxMs
  })
}

/**
 * Vrai si AU MOINS un match doit être suivi MAINTENANT :
 *  • pas encore réglé ET dans sa fenêtre [coup d'envoi - preroll ; +maxMs], OU
 *  • réglé depuis MOINS de SETTLE_GRACE_MS (on continue de tourner ~15 min après
 *    la fin pour être SÛR que le match est terminé et re-vérifier le score final).
 * @param settledAt Map ou objet { match_id → settled_at (ms epoch) }
 */
export function shouldTrack(schedule, settledAt, prerollMs, maxMs, now = Date.now()) {
  const at = id => settledAt instanceof Map ? settledAt.get(id) : (settledAt || {})[id]
  return (schedule || []).some(s => {
    const k = Date.parse(s.kickoff)
    if (!Number.isFinite(k)) return false
    const sa = at(s.match_id)
    if (sa != null && Number.isFinite(sa)) return now < sa + SETTLE_GRACE_MS
    return now >= k - prerollMs && now <= k + maxMs
  })
}

// Barème : +5 score exact · +4 bon nul · +3 bon vainqueur · 0 sinon.
export function betPoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 5
  if (realH > realA && predH > predA) return 3
  if (realH < realA && predH < predA) return 3
  if (realH === realA && predH === predA) return 4
  return 0
}

// ── Bonus « qualifié » des matchs à élimination directe ─────────────────────
// +2 si le joueur a trouvé l'équipe qui se qualifie (tirs au but inclus).
export const KO_QUALIFIER_BONUS = 2
const KO_ID_RE = /^(r32|r16|qf|sf|3rd|final)/
// Affiche → affiche du tour suivant (le vainqueur y est reporté). Sert à déduire le
// qualifié d'un match nul (réglé aux T.A.B.) directement depuis le bracket.
export const KO_NEXT = {
  'r32-1': 'r16-1', 'r32-2': 'r16-1', 'r32-3': 'r16-2', 'r32-4': 'r16-2',
  'r32-5': 'r16-3', 'r32-6': 'r16-3', 'r32-7': 'r16-4', 'r32-8': 'r16-4',
  'r32-9': 'r16-5', 'r32-10': 'r16-5', 'r32-11': 'r16-6', 'r32-12': 'r16-6',
  'r32-13': 'r16-7', 'r32-14': 'r16-7', 'r32-15': 'r16-8', 'r32-16': 'r16-8',
  'r16-1': 'qf-1', 'r16-2': 'qf-1', 'r16-3': 'qf-2', 'r16-4': 'qf-2',
  'r16-5': 'qf-3', 'r16-6': 'qf-3', 'r16-7': 'qf-4', 'r16-8': 'qf-4',
  'qf-1': 'sf-1', 'qf-2': 'sf-1', 'qf-3': 'sf-2', 'qf-4': 'sf-2',
  'sf-1': 'final', 'sf-2': 'final',
}
const _up = s => (s || '').toUpperCase()
export const isKnockout = id => KO_ID_RE.test(id || '')

/** Affiche du tour suivant + position (le vainqueur d'un slot impair va à HOME, pair à AWAY). */
export function koNextPos(id) {
  const slot = KO_NEXT[id]; if (!slot) return null
  const n = parseInt((id.split('-')[1] || '1'), 10)
  return { slot, pos: n % 2 === 1 ? 'home' : 'away' }
}

/** Vainqueur / perdant (codes courts) d'un match KO réglé. Nul → besoin du vainqueur T.A.B. explicite. */
function koWinLoss(id, me, r, tabWinners) {
  if (!me) return null
  const H = _up(me.home_short), A = _up(me.away_short)
  if (!H || !A) return null
  if (r.home_score > r.away_score) return { win: H, loss: A }
  if (r.away_score > r.home_score) return { win: A, loss: H }
  const w = _up((tabWinners || {})[id] || '')          // match nul → vainqueur aux tirs au but (donné)
  if (!w || (w !== H && w !== A)) return null
  return { win: w, loss: w === H ? A : H }
}

/**
 * Reconstruit l'arbre du tableau (R16 → finale) à partir des RÉSULTATS, en propageant le
 * vainqueur de chaque affiche dans son créneau du tour suivant (HOME pour un slot impair,
 * AWAY pour un pair) — donc selon le VRAI bracket FIFA, jamais selon l'horaire. Le perdant
 * des demies va à la petite finale. Pour les matchs nuls (T.A.B.), le vainqueur est fourni
 * via `tabWinners` { match_id → code court }. Idempotent et déterministe.
 * @returns { slot_id → { home_short?, away_short? } } pour les slots déterminés.
 */
export function propagateKnockout(koTeams, results, tabWinners) {
  const out = {}
  const ensure = s => (out[s] ||= {})
  const order = [
    ...Array.from({ length: 16 }, (_, i) => `r32-${i + 1}`),
    ...Array.from({ length: 8 }, (_, i) => `r16-${i + 1}`),
    ...Array.from({ length: 4 }, (_, i) => `qf-${i + 1}`),
    'sf-1', 'sf-2',
  ]
  for (const id of order) {
    const r = (results || {})[id]; if (!r) continue
    const me = out[id] || (koTeams || {})[id]              // équipes propagées si dispo, sinon bracket figé
    const wl = koWinLoss(id, me, r, tabWinners); if (!wl) continue
    const np = koNextPos(id)
    if (np) ensure(np.slot)[`${np.pos}_short`] = wl.win
    if (id === 'sf-1') ensure('3rd').home_short = wl.loss   // perdants des demies → petite finale
    if (id === 'sf-2') ensure('3rd').away_short = wl.loss
  }
  return out
}

/** Vrai qualifié d'une affiche KO : vainqueur au score, sinon (nul → T.A.B.) l'équipe de
 *  cette affiche qui figure au tour suivant. Déduit du bracket (knockout_teams). null si indéterminé. */
export function koActualQualifier(matchId, realH, realA, ko) {
  const me = (ko || {})[matchId]; if (!me) return null
  if (realH > realA) return _up(me.home_short) || null
  if (realA > realH) return _up(me.away_short) || null
  const nx = (ko || {})[KO_NEXT[matchId]]; if (!nx) return null
  const mine = new Set([me.home_short, me.away_short].filter(Boolean).map(_up))
  for (const t of [nx.home_short, nx.away_short]) if (t && mine.has(_up(t))) return _up(t)
  return null
}

/** Qualifié pronostiqué : vainqueur pronostiqué au score, sinon (prono nul) le choix explicite. */
export function koPredictedQualifier(matchId, predH, predA, qualifierShort, ko) {
  const me = (ko || {})[matchId]; if (!me) return null
  if (predH > predA) return _up(me.home_short) || null
  if (predA > predH) return _up(me.away_short) || null
  return qualifierShort ? _up(qualifierShort) : null
}

/**
 * Points totaux d'un pari.
 *  • Hors KO ou match KO décisif → barème normal (betPoints), sans bonus.
 *  • Match KO NUL (réglé aux tirs au but), Q = équipe qui se qualifie :
 *      - prono NUL  + bon qualifié choisi (= Q) → barème du nul (+5/+4) + KO_QUALIFIER_BONUS (+2) ;
 *      - prono VAINQUEUR dont l'équipe = Q       → +3 « bon vainqueur » (l'équipe qui passe = le vainqueur) ;
 *      - sinon → 0.
 */
export function scoreBet(matchId, predH, predA, qualifierShort, realH, realA, ko) {
  const base = betPoints(predH, predA, realH, realA)
  if (!isKnockout(matchId) || realH !== realA) return base   // hors KO ou match décisif
  const Q = koActualQualifier(matchId, realH, realA, ko)      // équipe qui se qualifie (T.A.B.)
  if (!Q) return base
  const me = (ko || {})[matchId] || {}
  if (predH === predA) {                                       // prono nul → +2 si bon qualifié choisi
    const pick = qualifierShort ? _up(qualifierShort) : null
    return base + (pick && pick === Q ? KO_QUALIFIER_BONUS : 0)
  }
  // prono vainqueur sur un match nul → +3 « bon vainqueur » si le vainqueur pronostiqué passe aux T.A.B.
  const predWinner = predH > predA ? _up(me.home_short) : _up(me.away_short)
  return base + (predWinner && predWinner === Q ? 3 : 0)
}

/**
 * Règle un match ENTIÈREMENT via REST (sans la fonction SQL settle_match, peu fiable) :
 *   1) upsert du résultat officiel dans match_results ;
 *   2) calcul + écriture des points de chaque pari (verrouillés) ;
 *   3) recalcul du score total de chaque joueur concerné = somme de SES points
 *      (auto-correcteur : corrige tout score faux/dérivé, idempotent).
 * Idempotent : si le résultat stocké est déjà identique → ne refait rien (changed:false).
 * @param sb  fonction REST : (path, init) => fetch(...) avec la clé service role
 * @returns { changed: boolean }
 */
export async function settleViaRest(sb, matchId, homeScore, awayScore) {
  // Idempotence : résultat déjà identique → rien à faire.
  const ex = await sb(`match_results?match_id=eq.${matchId}&select=home_score,away_score`)
  const exist = ex.ok ? (await ex.json())[0] : null
  if (exist && exist.home_score === homeScore && exist.away_score === awayScore) return { changed: false }

  // 1) Résultat officiel (upsert).
  await sb('match_results?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ match_id: matchId, home_score: homeScore, away_score: awayScore, settled_at: new Date().toISOString() }]),
  })

  // 2) Points de chaque pari sur ce match (verrouillés).
  const br = await sb(`bets?match_id=eq.${matchId}&select=id,user_id,home_score,away_score`)
  const bets = br.ok ? await br.json() : []
  for (const b of bets) {
    const pts = betPoints(b.home_score, b.away_score, homeScore, awayScore)
    await sb(`bets?id=eq.${b.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ points: pts, locked: true }),
    })
  }
  // 3) Le score des joueurs n'est PAS recalculé ici (sujet aux courses quand plusieurs
  //    matchs sont réglés en parallèle). C'est reconcileScores() — autoritaire et
  //    idempotent — qui fixe profiles.score = somme des points, à chaque passage.
  return { changed: true }
}

/**
 * Réconcilie ENTIÈREMENT le classement (autoritaire, idempotent, Supabase seul) :
 *   1) pour chaque match réglé, (re)calcule les points de TOUS ses paris d'après le
 *      résultat officiel — rattrape notamment les paris AJOUTÉS APRÈS le règlement
 *      (joueurs tardifs) dont les points étaient restés nuls ;
 *   2) pour chaque joueur, profiles.score = somme de SES points.
 * Insensible aux courses (worker + crons en parallèle), zéro quota API.
 * @returns nombre de profils corrigés
 */
export async function reconcileScores(sb) {
  // Lectures GROUPÉES (≈ 4 requêtes au lieu de ~65) → tient dans les limites du
  // worker Cloudflare (sous-requêtes), donc le recalcul aboutit toujours.
  const rrRes = await sb('match_results?select=match_id,home_score,away_score')
  const results = {}
  if (rrRes.ok) for (const r of await rrRes.json()) results[r.match_id] = r

  // Bracket éliminatoire → pour déduire le qualifié (bonus KO). Absent/à plat = pas de bonus.
  const ko = {}
  const koRes = await sb('knockout_teams?select=match_id,home_short,away_short')
  if (koRes.ok) for (const r of await koRes.json()) ko[r.match_id] = r

  // Tous les paris en une fois (paginé : PostgREST plafonne à 1000 lignes).
  // Tolérant : si la colonne qualifier_short n'existe pas encore (migration pas appliquée),
  // on refait la lecture SANS elle — surtout ne jamais finir avec 0 pari (sinon scores remis à 0).
  const bets = []
  let withQual = true
  for (let off = 0; ; off += 1000) {
    const cols = withQual
      ? 'id,user_id,match_id,home_score,away_score,qualifier_short,points,locked'
      : 'id,user_id,match_id,home_score,away_score,points,locked'
    const br = await sb(`bets?select=${cols}&order=id.asc&limit=1000&offset=${off}`)
    if (!br.ok) {
      if (withQual && off === 0) { withQual = false; off = -1000; continue }   // colonne absente → refetch
      break
    }
    const rows = await br.json()
    bets.push(...rows)
    if (rows.length < 1000) break
  }

  // 1) (Re)pointe les paris des matchs réglés (rattrape les paris tardifs) + somme par joueur.
  const sums = {}
  for (const b of bets) {
    const r = results[b.match_id]
    let pts = b.points
    if (r) {
      const exp = scoreBet(b.match_id, b.home_score, b.away_score, b.qualifier_short, r.home_score, r.away_score, ko)
      if (b.points !== exp || !b.locked) {
        await sb(`bets?id=eq.${b.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ points: exp, locked: true }),
        })
        pts = exp
      }
    }
    sums[b.user_id] = (sums[b.user_id] || 0) + (pts || 0)
  }

  // 2) profiles.score = somme des points (écrit uniquement les profils qui changent).
  const pr = await sb('profiles?select=id,score')
  if (!pr.ok) return 0
  let fixed = 0
  for (const p of await pr.json()) {
    const total = sums[p.id] || 0
    if (total !== p.score) {
      await sb(`profiles?id=eq.${p.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ score: total }),
      })
      fixed++
    }
  }
  return fixed
}

export const GROUPS = {
  A: ['MEX','KOR','ZAF','CZE'], B: ['CAN','SUI','QAT','BIH'], C: ['BRA','MAR','SCO','HAI'],
  D: ['USA','PAR','AUS','TUR'], E: ['GER','ECU','CIV','CUR'], F: ['NED','JPN','SWE','TUN'],
  G: ['BEL','EGY','IRN','NZL'], H: ['ESP','URU','SAU','CPV'], I: ['FRA','SEN','NOR','IRQ'],
  J: ['ARG','DZA','AUT','JOR'], K: ['POR','COL','UZB','COD'], L: ['ENG','CRO','PAN','GHA'],
}
export const shortToGroup = {}
for (const [g, arr] of Object.entries(GROUPS)) arr.forEach(s => { shortToGroup[s] = g })

const ALIASES = {
  MEX:['Mexico'], KOR:['South Korea','Korea Republic'], ZAF:['South Africa'], CZE:['Czech Republic','Czechia'],
  CAN:['Canada'], SUI:['Switzerland'], QAT:['Qatar'], BIH:['Bosnia & Herzegovina','Bosnia and Herzegovina'],
  BRA:['Brazil'], MAR:['Morocco'], SCO:['Scotland'], HAI:['Haiti'],
  USA:['USA','United States'], PAR:['Paraguay'], AUS:['Australia'], TUR:['Turkey','Turkiye','Türkiye'],
  GER:['Germany'], ECU:['Ecuador'], CIV:['Ivory Coast',"Cote d'Ivoire"], CUR:['Curacao','Curaçao'],
  NED:['Netherlands'], JPN:['Japan'], SWE:['Sweden'], TUN:['Tunisia'],
  BEL:['Belgium'], EGY:['Egypt'], IRN:['Iran'], NZL:['New Zealand'],
  ESP:['Spain'], URU:['Uruguay'], SAU:['Saudi Arabia'], CPV:['Cape Verde','Cape Verde Islands','Cabo Verde'],
  FRA:['France'], SEN:['Senegal'], NOR:['Norway'], IRQ:['Iraq'],
  ARG:['Argentina'], DZA:['Algeria'], AUT:['Austria'], JOR:['Jordan'],
  POR:['Portugal'], COL:['Colombia'], UZB:['Uzbekistan'], COD:['Congo DR','DR Congo','Democratic Republic of Congo','Congo'],
  ENG:['England'], CRO:['Croatia'], PAN:['Panama'], GHA:['Ghana'],
}
export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
const NAME2SHORT = {}
for (const [short, names] of Object.entries(ALIASES)) names.forEach(n => { NAME2SHORT[norm(n)] = short })

export function shortOf(name) { return NAME2SHORT[norm(name)] || null }

// Code court (minuscule) de l'équipe à DOMICILE selon NOTRE match_id de groupe
// (ex. 'gD-md1-usa-par' → 'usa'). null pour l'élimination directe (équipes TBD).
export function appHomeShort(matchId) {
  const m = /^g[A-L]-md\d+-([a-z]+)-[a-z]+$/.exec(matchId || '')
  return m ? m[1] : null
}

/**
 * Normalise une fixture API vers l'orientation de NOTRE match_id.
 * Si l'API place à domicile l'équipe que nous classons à l'extérieur (orientation
 * opposée), on inverse score ET côté des buteurs → score exact et buteurs du bon côté.
 * Renvoie { swapped, homeScore, awayScore, appHomeId } (appHomeId = id API de l'équipe
 * que NOUS considérons à domicile, à passer à scorersFrom/redCardsFrom).
 */
export function orient(matchId, f) {
  const appH = appHomeShort(matchId)
  const apiH = shortOf(f?.teams?.home?.name)
  const swapped = !!(appH && apiH && appH !== apiH.toLowerCase())
  return {
    swapped,
    homeScore: swapped ? (f?.goals?.away ?? 0) : (f?.goals?.home ?? 0),
    awayScore: swapped ? (f?.goals?.home ?? 0) : (f?.goals?.away ?? 0),
    appHomeId: swapped ? f?.teams?.away?.id : f?.teams?.home?.id,
  }
}

/** Renvoie notre match_id pour une fixture de phase de groupes, ou null. */
export function fixtureToMatchId(f, validIds) {
  const round = f.league?.round || ''
  const mdM = round.match(/(\d+)/)
  const md = mdM ? Number(mdM[1]) : null
  const hs = shortOf(f.teams?.home?.name)
  const as = shortOf(f.teams?.away?.name)
  if (!round.toLowerCase().includes('group') || !md || !hs || !as) return null
  const id = `g${shortToGroup[hs]}-md${md}-${hs.toLowerCase()}-${as.toLowerCase()}`
  if (validIds && validIds.size && !validIds.has(id)) {
    const alt = `g${shortToGroup[as]}-md${md}-${as.toLowerCase()}-${hs.toLowerCase()}`
    return validIds.has(alt) ? alt : null
  }
  return id
}

// Rounds à élimination directe (l'ordre = priorité de test des libellés API).
const KO_ROUNDS = [
  { re: /round of 32|1\/16|last 32/i, prefix: 'r32',   n: 16 },
  { re: /round of 16|1\/8|last 16/i,  prefix: 'r16',   n: 8  },
  { re: /quarter/i,                   prefix: 'qf',    n: 4  },
  { re: /semi/i,                      prefix: 'sf',    n: 2  },
  { re: /3rd|third place/i,           prefix: '3rd',   n: 1  },
  { re: /final/i,                     prefix: 'final', n: 1  },
]

// Tour des 32 → créneau du TABLEAU (bracket officiel FIFA), et non l'ordre des horaires.
// Clé = les deux codes courts des équipes, triés et joints par '|'. Les slots r32-1..16
// suivent l'arbre du tableau de l'app (r32-1 & r32-2 → r16-1, etc.) : ainsi les chemins
// 8es/quarts/demies sont corrects. (Les affiches sont figées depuis la fin des poules.)
export const R32_SLOT_BY_TEAMS = {
  'GER|PAR': 'r32-1',  'FRA|SWE': 'r32-2',  'CAN|ZAF': 'r32-3',  'MAR|NED': 'r32-4',
  'CRO|POR': 'r32-5',  'AUT|ESP': 'r32-6',  'BIH|USA': 'r32-7',  'BEL|SEN': 'r32-8',
  'BRA|JPN': 'r32-9',  'CIV|NOR': 'r32-10', 'ECU|MEX': 'r32-11', 'COD|ENG': 'r32-12',
  'ARG|CPV': 'r32-13', 'AUS|EGY': 'r32-14', 'DZA|SUI': 'r32-15', 'COL|GHA': 'r32-16',
}
const r32Key = (hs, as) => [hs, as].sort().join('|')

// ── Placement STRUCTUREL des affiches R16→finale (par arbre, jamais par horaire) ──
// Équipes possibles de chaque slot R32 (les 2 équipes de l'affiche), pour propager les
// sous-arbres vers le haut et placer toute affiche KO dans son vrai créneau du bracket.
const R32_SLOT_TEAMS = (() => {
  const m = {}
  for (const [key, slot] of Object.entries(R32_SLOT_BY_TEAMS)) m[slot] = key.split('|').map(_up)
  return m
})()
const _prevPrefix = { r16: 'r32', qf: 'r16', sf: 'qf', final: 'sf' }
/** Les deux affiches du tour précédent qui alimentent un slot (feeders), HOME puis AWAY. */
function koFeeders(slot) {
  const [pfx, kStr] = slot.split('-')
  const prev = _prevPrefix[pfx]; if (!prev) return null
  const k = parseInt(kStr || '1', 10)
  return prev === 'sf' ? ['sf-1', 'sf-2'] : [`${prev}-${2 * k - 1}`, `${prev}-${2 * k}`]
}
const _teamSetCache = {}
/** Ensemble des équipes susceptibles d'atteindre ce slot (union récursive des feeders). */
function koTeamSet(slot) {
  if (_teamSetCache[slot]) return _teamSetCache[slot]
  let set
  if (R32_SLOT_TEAMS[slot]) set = new Set(R32_SLOT_TEAMS[slot])
  else {
    const fd = koFeeders(slot)
    set = new Set()
    if (fd) for (const f of fd) for (const t of koTeamSet(f)) set.add(t)
  }
  return (_teamSetCache[slot] = set)
}
const KO_SLOT_COUNT = { r16: 8, qf: 4, sf: 2, final: 1 }
/**
 * Créneau du tableau d'une affiche KO (R16→finale) à partir des équipes : on cherche le slot
 * dont un feeder contient une équipe et l'autre feeder l'autre équipe. Robuste à l'ordre des
 * horaires. Renvoie le match_id du slot, ou null si indéterminable (équipes inconnues).
 */
export function koSlotForFixture(prefix, hs, as) {
  const H = _up(hs), A = _up(as)
  if (!H || !A) return null
  const n = KO_SLOT_COUNT[prefix]; if (!n) return null
  for (let k = 1; k <= n; k++) {
    const slot = n === 1 ? prefix : `${prefix}-${k}`
    const fd = koFeeders(slot); if (!fd) continue
    const L = koTeamSet(fd[0]), R = koTeamSet(fd[1])
    if ((L.has(H) && R.has(A)) || (L.has(A) && R.has(H))) return slot
  }
  return null
}

/**
 * Construit le mapping FIABLE fixture_id → notre match_id pour TOUTE la compétition
 * (groupes par équipes/journée, élimination directe par tour + ordre chronologique).
 * Renvoie { map: Map<fixtureId, matchId>, unmatched: [...] }.
 */
export function buildFixtureMap(fixtures, validIds) {
  const map = new Map()
  const buckets = {}
  const unmatched = []
  for (const f of (fixtures || [])) {
    const fid = f.fixture?.id
    if (!fid) continue
    const round = f.league?.round || ''
    if (/group/i.test(round)) {
      const id = fixtureToMatchId(f, validIds)
      if (id) map.set(fid, id)
      else unmatched.push(`${f.teams?.home?.name} vs ${f.teams?.away?.name} [${round}]`)
      continue
    }
    const ko = KO_ROUNDS.find(k => k.re.test(round))
    if (!ko) { unmatched.push(`${f.teams?.home?.name} vs ${f.teams?.away?.name} [${round}]`); continue }
    const ts = Date.parse(f.fixture?.date || '') || 0
    ;(buckets[ko.prefix] ||= []).push({ fid, ts, hs: shortOf(f.teams?.home?.name), as: shortOf(f.teams?.away?.name) })
  }
  for (const ko of KO_ROUNDS) {
    const arr = buckets[ko.prefix]
    if (!arr) continue
    // Tour des 32 : si TOUTES les affiches sont identifiables par leurs équipes, on place
    // chaque match dans son VRAI créneau du tableau (bracket officiel FIFA), pas par l'horaire.
    if (ko.prefix === 'r32' && arr.every(x => x.hs && x.as && R32_SLOT_BY_TEAMS[r32Key(x.hs, x.as)])) {
      for (const x of arr) map.set(x.fid, R32_SLOT_BY_TEAMS[r32Key(x.hs, x.as)])
      continue
    }
    // R16 → finale : placement STRUCTUREL (par arbre) quand les équipes sont connues —
    // garantit que 8es/quarts/demies/finale s'enchaînent au bon endroit du tableau.
    // La petite finale (3rd, slot unique) et les affiches non identifiables retombent
    // sur l'ordre chronologique.
    if (ko.prefix !== '3rd' && ko.n > 0) {
      const placed = new Set()
      const leftovers = []
      for (const x of arr) {
        const slot = koSlotForFixture(ko.prefix, x.hs, x.as)
        if (slot && !placed.has(slot)) { map.set(x.fid, slot); placed.add(slot) }
        else leftovers.push(x)
      }
      if (leftovers.length) {   // repli chronologique sur les créneaux restants
        leftovers.sort((a, b) => a.ts - b.ts)
        let k = 1
        for (const x of leftovers) {
          while (placed.has(`${ko.prefix}-${k}`)) k++
          const slot = ko.n === 1 ? ko.prefix : `${ko.prefix}-${k}`
          map.set(x.fid, slot); placed.add(slot); k++
        }
      }
      continue
    }
    arr.sort((a, b) => a.ts - b.ts)
    arr.forEach((x, i) => map.set(x.fid, ko.n === 1 ? ko.prefix : `${ko.prefix}-${i + 1}`))
  }
  return { map, unmatched }
}
