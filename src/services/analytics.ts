// TRIVELA — Analytics unifié : chaque évènement part vers PostHog ET Supabase.
//
//  • PostHog  → clics (autocapture), pages vues, rétention, funnels, dashboards prêts.
//  • Supabase → copie brute dans la table `analytics_events` (cf. db-analytics.sql),
//               que tu possèdes et requêtes en SQL.
//
// Tout est défensif : l'analytics ne doit JAMAIS casser ni bloquer l'UI.
// Sans clé PostHog (VITE_POSTHOG_KEY absente) → PostHog est ignoré, Supabase continue.
//
// ⚠️ PÉRIMÈTRE : on ne collecte QUE sur le site de production trivela.ch.
// En local (localhost), sur les URL de prévisualisation Cloudflare ou tout autre
// domaine, l'analytics est totalement inactif → seul trivela.ch est « affecté ».

import posthog from 'posthog-js'
import { supabase } from './supabase'

const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com'

// Seuls ces domaines déclenchent la collecte (PostHog + Supabase).
const PROD_HOSTS = new Set(['trivela.ch', 'www.trivela.ch'])
function isProductionSite(): boolean {
  try { return PROD_HOSTS.has(location.hostname) } catch { return false }
}

let started      = false
let enabled      = false   // vrai uniquement sur trivela.ch
let posthogReady = false
let currentUserId: string | null = null

// Id anonyme STABLE (persiste entre les sessions → indispensable pour la rétention).
function anonId(): string {
  try {
    let id = localStorage.getItem('trivela-anon-id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('trivela-anon-id', id) }
    return id
  } catch { return 'anon' }
}

// Id de session (par onglet) — regroupe l'activité d'une même visite.
function sessionId(): string {
  try {
    let id = sessionStorage.getItem('trivela-session-id')
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('trivela-session-id', id) }
    return id
  } catch { return 'session' }
}

/** À appeler une fois au démarrage de l'app. */
export function initAnalytics(): void {
  if (started) return
  started = true
  // Hors trivela.ch (dev, prévisualisation, autre domaine) → analytics désactivé.
  if (!isProductionSite()) return
  enabled = true
  if (!POSTHOG_KEY) return
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,   // on envoie nos propres pages vues (avec le nom de section)
      autocapture: true,         // capture automatiquement les clics → couvre « clicks »
      bootstrap: { distinctID: anonId() },
    })
    posthogReady = true
  } catch {
    posthogReady = false
  }
}

/** Lie l'activité à un utilisateur connecté (ou réinitialise à la déconnexion). */
export function identify(user: { id: string; pseudo?: string; countryCode?: string } | null): void {
  if (!enabled) return
  if (user) {
    currentUserId = user.id
    if (posthogReady) {
      try { posthog.identify(user.id, { pseudo: user.pseudo, country: user.countryCode }) } catch { /* ignore */ }
    }
  } else {
    if (posthogReady) { try { posthog.reset() } catch { /* ignore */ } }
    currentUserId = null
  }
}

/** Envoie un évènement vers PostHog + Supabase. Ne lève jamais. */
export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (!enabled) return   // hors trivela.ch → aucune collecte (ni PostHog, ni Supabase)
  if (posthogReady) {
    try { posthog.capture(event, properties) } catch { /* ignore */ }
  }
  void writeToSupabase(event, properties)
}

/** Page / section vue. */
export function trackPageview(section: string): void {
  track('$pageview', {
    section,
    path: section,
    $current_url: typeof location !== 'undefined' ? location.href : undefined,
  })
}

async function writeToSupabase(event: string, properties: Record<string, unknown>): Promise<void> {
  try {
    const path = typeof properties.path === 'string'
      ? properties.path
      : (typeof location !== 'undefined' ? (location.hash || location.pathname || null) : null)
    await supabase.from('analytics_events').insert({
      event,
      distinct_id: currentUserId ?? anonId(),
      user_id:     currentUserId,
      session_id:  sessionId(),
      path,
      referrer:    typeof document !== 'undefined' ? (document.referrer || null) : null,
      properties,
    })
  } catch {
    // On ne bloque jamais l'UI pour de l'analytics.
  }
}
