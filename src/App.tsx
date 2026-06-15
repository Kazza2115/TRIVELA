import { useState, useEffect, useRef } from 'react'
import Globe        from './components/Globe'
import Paris        from './pages/Paris'
import Tendances    from './pages/Tendances'
import Stats        from './pages/Stats'
import Classement   from './pages/Classement'
import PlayerProfile from './pages/PlayerProfile'
import Actualites   from './pages/Actualites'
import Competition   from './pages/Competition'
import ChatSheet    from './components/ChatSheet'
import ChatPreview  from './components/ChatPreview'
import AuthModal    from './components/AuthModal'
import ResetPasswordModal from './components/ResetPasswordModal'
import ProfileModal from './components/ProfileModal'
import MenuDrawer   from './components/MenuDrawer'
import ErrorBoundary from './components/ErrorBoundary'
import UpdateBanner from './components/UpdateBanner'
import NotificationInbox from './components/NotificationInbox'
import TrivelaLogo  from './components/TrivelaLogo'
import { subscribeToAuth, getLeaderboard, subscribeToPresence, subscribeToNewMessages, getLive, subscribeToLive, getResults, subscribeToResults, beginPasswordRecovery, getNotifications, markNotificationsRead, subscribeToNotifications } from './services/auth'
import type { UserProfile, PresenceUser, AppNotification } from './services/auth'
import { ALL_MATCHES, matchKickoffUTC } from './data/wc2026Matches'
import { playMentionSound } from './utils/sound'
import { initAnalytics, identify as analyticsIdentify, track, trackPageview } from './services/analytics'
import {
  IconGlobe, IconTrophy, IconBolt,
} from './components/NavIcons'
import './index.css'

export type SectionId = 'globe' | 'paris' | 'classement' | 'actualites' | 'chat' | 'competition' | 'tendances' | 'stats'

const NAV_ITEMS: {
  id: SectionId; Icon: React.FC<{ size?: number; color?: string }>
  label: string
}[] = [
  { id: 'paris',      Icon: IconBolt,   label: 'Paris'      },
  { id: 'globe',      Icon: IconGlobe,  label: 'Globe'      },
  { id: 'classement', Icon: IconTrophy, label: 'Classement' },
]

// Funnel: all items stay within the nav band — outer items touch the top edge
const FUNNEL_BOTTOM_PX = [8, 2, 8]

export default function App() {
  const [section,     setSection]     = useState<SectionId>('globe')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [showAuth,    setShowAuth]    = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showMenu,    setShowMenu]    = useState(false)
  // Détecte un lien de réinitialisation de mot de passe dès l'ouverture (synchrone, avant l'effet d'auth)
  const [recovery,    setRecovery]    = useState(() => beginPasswordRecovery())
  const [darkMode,    setDarkMode]    = useState(() => {
    try { return localStorage.getItem('trivela-theme') === 'dark' } catch { return false }
  })

  useEffect(() => subscribeToAuth(setCurrentUser), [])

  // Analytics : init au démarrage (PostHog + Supabase)
  useEffect(() => { initAnalytics() }, [])

  // Lie / délie l'activité à l'utilisateur connecté (pour la rétention par compte)
  useEffect(() => {
    analyticsIdentify(currentUser
      ? { id: currentUser.id, pseudo: currentUser.pseudo, countryCode: currentUser.countryCode }
      : null)
  }, [currentUser])

  // Page vue à chaque changement de section
  useEffect(() => { trackPageview(section) }, [section])

  // Lien de récupération invalide/expiré : prévenir et proposer une nouvelle demande
  useEffect(() => {
    if (recovery.error) {
      alert(`${recovery.error}\n\nLe lien a peut-être expiré — redemandez un e-mail de réinitialisation.`)
      setShowAuth(true)
      setRecovery({ active: false })
    }
  }, [recovery.error])

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else          document.documentElement.classList.remove('dark')
  }, [darkMode])

  const toggleTheme = () => {
    setDarkMode(d => {
      const next = !d
      try { localStorage.setItem('trivela-theme', next ? 'dark' : 'light') } catch {}
      return next
    })
  }

  const [activeNav, setActiveNav] = useState<SectionId>('globe')
  const [viewedPlayer, setViewedPlayer] = useState<{ player: UserProfile; rank: number } | null>(null)
  const [profileFocus, setProfileFocus] = useState<string | null>(null)   // matchId à mettre en avant dans le profil
  const [chatOpen, setChatOpen] = useState(false)
  const [online, setOnline] = useState<PresenceUser[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [inboxOpen, setInboxOpen] = useState(false)
  const [liveIds, setLiveIds] = useState<string[]>([])
  const [parisFocus, setParisFocus] = useState<{ id: string; nonce: number } | null>(null)
  const [competitionConf, setCompetitionConf] = useState<string | null>(null)
  const [trendsFocus, setTrendsFocus] = useState<string | null>(null)

  // Depuis la page Paris (clic sur une tendance) ou le menu → page Tendances.
  const openTrends = (matchId?: string) => {
    track('trends_open', { matchId: matchId ?? null })
    setViewedPlayer(null)
    setTrendsFocus(matchId ?? null)
    setSection('tendances'); setActiveNav('tendances')
  }

  // Depuis le globe : touche un continent / pays vedette → page stats de la compétition
  const showCompetition = (conf: string) => {
    track('competition_open', { conf })
    setViewedPlayer(null)
    setCompetitionConf(conf)
    setSection('competition')
    setActiveNav('globe')
  }

  // Matchs en direct (pour le bouton flottant "EN DIRECT")
  // = présents dans match_live OU dans leur créneau horaire (coup d'envoi → +135 min),
  //   MAIS jamais un match qui a déjà un résultat final (sinon il resterait "rouge").
  useEffect(() => {
    const compute = async () => {
      const [liveRows, results] = await Promise.all([getLive(), getResults()])
      const settled = new Set(results.map(r => r.matchId))
      const fromDb = liveRows.map(l => l.matchId).filter(id => !settled.has(id))
      const now = Date.now()
      const timeLive = ALL_MATCHES.filter(m => {
        if (m.home.code === 'un') return false
        if (settled.has(m.id)) return false   // match terminé → plus "en direct"
        const k = matchKickoffUTC(m)
        return k !== null && now >= k && now < k + 135 * 60 * 1000
      }).map(m => m.id)
      setLiveIds([...new Set([...fromDb, ...timeLive])])
    }
    compute()
    const unsubLive = subscribeToLive(compute)
    const unsubRes  = subscribeToResults(compute)
    const iv = setInterval(compute, 30000)
    return () => { unsubLive(); unsubRes(); clearInterval(iv) }
  }, [])

  const goToLive = () => {
    track('live_click', { matchId: liveIds[0] ?? null })
    setViewedPlayer(null)
    setSection('paris'); setActiveNav('paris')
    if (liveIds[0]) setParisFocus({ id: liveIds[0], nonce: Date.now() })
  }
  const [mentionToast, setMentionToast] = useState<{ pseudo: string; body: string } | null>(null)
  const chatOpenRef = useRef(chatOpen)
  useEffect(() => { chatOpenRef.current = chatOpen }, [chatOpen])

  // Ouvre le chat (et demande une fois l'autorisation de notification)
  const openChat = () => {
    track('chat_open')
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    setChatOpen(true)
  }

  useEffect(() => {
    const me = currentUser
      ? { id: currentUser.id, pseudo: currentUser.pseudo, countryCode: currentUser.countryCode }
      : null
    return subscribeToPresence(me, setOnline)
  }, [currentUser])

  // Boîte de réception : charge + écoute les notifications du joueur en temps réel
  useEffect(() => {
    if (!currentUser) { setNotifications([]); return }
    const load = () => getNotifications(currentUser.id).then(setNotifications)
    load()
    const unsub = subscribeToNotifications(currentUser.id, load)
    const iv = setInterval(load, 60000)   // filet de sécurité si un push est manqué
    return () => { unsub(); clearInterval(iv) }
  }, [currentUser])

  const unreadCount = notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0)

  const openInbox = () => {
    track('notifications_open', { unread: unreadCount })
    setInboxOpen(true)
    if (currentUser && unreadCount > 0) {
      markNotificationsRead(currentUser.id).catch(() => {})
      setNotifications(ns => ns.map(n => ({ ...n, read: true })))   // badge effacé immédiatement
    }
  }

  const onSelectNotification = (n: AppNotification) => {
    setInboxOpen(false)
    // Mention (chat) → ouvre le chat. Commentaire/note sur un prono → ouvre MON profil
    // directement sur le pronostic concerné (section dépliée + commentaires ouverts).
    if (n.type === 'mention') openChat()
    else openOwnProfile(n.matchId ?? undefined)
  }

  // Notification quand on est mentionné (@pseudo) dans le chat
  useEffect(() => {
    if (!currentUser) return
    const esc = currentUser.pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`@${esc}(?![\\p{L}0-9_])`, 'iu')
    return subscribeToNewMessages(m => {
      if (m.userId === currentUser.id || !re.test(m.body)) return
      playMentionSound()
      if (!chatOpenRef.current) {
        setMentionToast({ pseudo: m.pseudo, body: m.body })
        setTimeout(() => setMentionToast(null), 6000)
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(`${m.pseudo} t'a mentionné`, { body: m.body }) } catch { /* ignore */ }
        }
      }
    })
  }, [currentUser])

  const back       = () => { setViewedPlayer(null); setSection('globe'); setActiveNav('globe') }
  const openAuth   = () => { track('auth_open'); setShowAuth(true) }
  const handleAuth = (user: UserProfile) => { setCurrentUser(user); setShowAuth(false) }
  const handleLogout = () => { setCurrentUser(null); setShowProfile(false) }
  const navigateTo   = (s: string) => { track('nav_click', { to: s, from: 'globe' }); setViewedPlayer(null); setSection(s as SectionId); setActiveNav(s as SectionId) }
  const navigateMenu = (s: SectionId) => {
    track('nav_click', { to: s, from: 'menu' })
    if (s === 'chat') { openChat(); return }   // chat = panneau sur l'accueil, pas une page
    if (s === 'tendances') { openTrends(); return }   // ouvre sur le match le plus proche
    setViewedPlayer(null); setSection(s); setActiveNav(s)
  }
  const openProfileFromChat = async (userId: string) => {
    const board = await getLeaderboard()
    const idx = board.findIndex(p => p.id === userId)
    if (idx === -1) return
    setChatOpen(false)
    setViewedPlayer({ player: board[idx], rank: idx + 1 })
    setSection('classement'); setActiveNav('classement')
  }

  // Mon avatar (en haut) → la MÊME page de profil que les autres joueurs.
  const openOwnProfile = async (focusMatchId?: string) => {
    if (!currentUser) return
    setProfileFocus(focusMatchId ?? null)
    const board = await getLeaderboard()
    const idx = board.findIndex(p => p.id === currentUser.id)
    setViewedPlayer({ player: idx >= 0 ? board[idx] : currentUser, rank: idx >= 0 ? idx + 1 : 0 })
    setSection('classement'); setActiveNav('classement')
  }

  const gold   = '#C89B3C'
  const dimCol = '#AEAEB2'

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)',
      paddingLeft: 'var(--sal)', paddingRight: 'var(--sar)',
    }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0, height: 'var(--header-h)',
        position: 'relative',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', zIndex: 10,
        background: 'var(--bg-header)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid var(--border-ui)',
      }}>
        {/* Left: hamburger */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
        <button
          onClick={() => setShowMenu(true)}
          style={{
            width: 36, height: 36, flexShrink: 0,
            background: 'var(--bg-fill)', border: '1px solid var(--border-ui)',
            borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 0.15s',
          }}
          onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
          onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="18" height="13" viewBox="0 0 18 13" fill="none">
            <rect y="0"  width="18" height="2" rx="1" fill={dimCol}/>
            <rect y="5.5" width="12" height="2" rx="1" fill={dimCol}/>
            <rect y="11" width="18" height="2" rx="1" fill={dimCol}/>
          </svg>
        </button>
        </div>

        {/* Center: logo — en flux normal, jamais en chevauchement */}
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={() => { setSection('globe'); setActiveNav('globe') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 2px', borderRadius: 8, transition: 'opacity 0.18s',
              display: 'flex', alignItems: 'center',
            }}
            onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
            onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
          >
            <TrivelaLogo size={88} color={gold} />
          </button>
        </div>

        {/* Right: theme toggle + cloche + user */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={darkMode ? 'Mode clair' : 'Mode sombre'}
            className={darkMode ? 'sun-btn' : 'moon-btn'}
            style={{
              width: 34, height: 34, flexShrink: 0,
              background: darkMode ? 'rgba(200,155,60,0.10)' : 'rgba(139,92,246,0.08)',
              border: darkMode ? '1px solid rgba(200,155,60,0.25)' : '1px solid rgba(139,92,246,0.25)',
              borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'opacity 0.15s, background 0.3s, border-color 0.3s',
            }}
            onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
            onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
          >
            {darkMode ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <line x1="12" y1="2"  x2="12" y2="5"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
                <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
                <line x1="2"  y1="12" x2="5"  y2="12"/>
                <line x1="19" y1="12" x2="22" y2="12"/>
                <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
                <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* Cloche notifications (badge rouge) — seulement si connecté */}
          {currentUser && (
            <button
              onClick={openInbox}
              title="Notifications"
              style={{
                position: 'relative', width: 34, height: 34, flexShrink: 0,
                background: 'var(--bg-fill)', border: '1px solid var(--border-ui)',
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'opacity 0.15s',
              }}
              onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
              onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={dimCol} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17,
                  padding: '0 4px', borderRadius: 9, background: '#dc2626', color: '#fff',
                  fontSize: 10, fontWeight: 800, lineHeight: '17px', textAlign: 'center',
                  boxShadow: '0 1px 4px rgba(220,38,38,0.5)', border: '1.5px solid var(--bg-header)',
                }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
          )}

          {/* User / login — avatar-drapeau compact (le pseudo est sur la page profil) */}
          {currentUser ? (
            <button onClick={() => openOwnProfile()} title={currentUser.pseudo} style={{
              width: 34, height: 34, flexShrink: 0, padding: 0,
              background: 'var(--bg-fill)', border: '1px solid var(--border-ui)',
              borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'opacity 0.15s',
            }}
              onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
              onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
            >
              <img src={`https://flagcdn.com/w40/${currentUser.countryCode}.png`}
                alt={currentUser.countryName}
                style={{ width: 24, height: 16, borderRadius: 3, objectFit: 'cover' }} />
            </button>
          ) : (
            <button onClick={openAuth} style={{
              padding: '7px 14px',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              border: 'none', borderRadius: 20,
              color: '#0D0800', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(200,155,60,0.35)',
              transition: 'transform 0.12s',
            }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
              onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Connexion
            </button>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>

        {/* Globe */}
        <div style={{
          width: '100%', height: '100%', position: 'relative', background: 'var(--bg)',
          display: section === 'globe' ? 'block' : 'none',
        }}>
          <ErrorBoundary label="globe">
            <Globe onNavigate={navigateTo} onSelectContinent={showCompetition} isActive={section === 'globe'} currentUser={currentUser} />
          </ErrorBoundary>

          <p style={{
            position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center',
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--text-3)', pointerEvents: 'none', fontWeight: 600,
            animation: 'fadeIn 2s ease 1.5s both',
          }}>
            Touchez un pays · Faites pivoter
          </p>

          {/* Aperçu du chat (carte) — seul élément flottant de l'accueil */}
          <ChatPreview onOpen={openChat} />
        </div>

        {section === 'actualites' && <ErrorBoundary label="actualites"><Actualites onBack={back} /></ErrorBoundary>}
        {section === 'competition' && competitionConf && <ErrorBoundary label="competition"><Competition conf={competitionConf} onBack={back} /></ErrorBoundary>}
        {section === 'tendances'  && <ErrorBoundary label="tendances"><Tendances onBack={back} focusMatchId={trendsFocus} currentUser={currentUser} /></ErrorBoundary>}
        {section === 'stats'      && <ErrorBoundary label="stats"><Stats onBack={back} currentUser={currentUser} /></ErrorBoundary>}
        {section === 'paris'      && <ErrorBoundary label="paris"><Paris onBack={back} currentUser={currentUser} onOpenAuth={openAuth} focus={parisFocus} onOpenTrends={openTrends} /></ErrorBoundary>}
        {section === 'classement' && (
          <ErrorBoundary label="classement">
            {viewedPlayer
              ? <PlayerProfile
                  player={viewedPlayer.player} rank={viewedPlayer.rank}
                  focusMatchId={profileFocus}
                  currentUser={currentUser} onBack={() => { setViewedPlayer(null); setProfileFocus(null) }}
                  onEditProfile={() => setShowProfile(true)} />
              : <Classement
                  onBack={back} currentUser={currentUser} onOpenAuth={openAuth}
                  onSelectPlayer={(player, rank) => { setProfileFocus(null); setViewedPlayer({ player, rank }) }} />}
          </ErrorBoundary>
        )}
      </div>

      {/* ── Bottom nav ────────────────────────────────────────── */}
      <nav style={{
        flexShrink: 0, height: 72, position: 'relative', overflow: 'hidden',
        background: 'var(--bg-nav)',
        borderTop: '1px solid var(--border-ui)',
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        zIndex: 20,
      }}>
        {NAV_ITEMS.map(({ id, Icon, label }, idx) => {
          const active   = activeNav === id
          const bottomPx = FUNNEL_BOTTOM_PX[idx]
          const leftPct  = (idx + 0.5) * (100 / NAV_ITEMS.length)
          const isGlobe  = id === 'globe'

          return (
            <button key={id}
              onClick={() => { setViewedPlayer(null); setActiveNav(id); setSection(id) }}
              style={{
                position: 'absolute',
                bottom: bottomPx, left: `${leftPct}%`,
                transform: 'translateX(-50%)', width: 64,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                background: active ? 'rgba(200,155,60,0.10)' : 'var(--bg-nav-item)',
                border: active ? `1px solid ${gold}55` : '1px solid var(--border-ui)',
                borderRadius: 14,
                backdropFilter: 'saturate(180%) blur(20px)',
                WebkitBackdropFilter: 'saturate(180%) blur(20px)',
                boxShadow: active ? `0 2px 10px ${gold}22` : '0 1px 6px rgba(0,0,0,0.07)',
                cursor: 'pointer', padding: '8px 4px 7px',
                transition: 'opacity 0.15s, background 0.2s, border-color 0.2s, box-shadow 0.2s',
              }}
              onPointerDown={e => (e.currentTarget.style.opacity = '0.45')}
              onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
            >
              <Icon size={isGlobe ? 26 : 22} color={active ? gold : dimCol} />
              <span style={{
                fontSize: 8, fontWeight: 600, letterSpacing: 0.3,
                color: active ? gold : dimCol, textTransform: 'uppercase',
                transition: 'color 0.2s',
                maxWidth: 60, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Menu drawer ───────────────────────────────────────── */}
      <MenuDrawer
        open={showMenu}
        onClose={() => setShowMenu(false)}
        onNavigate={navigateMenu}
        onSelectCompetition={showCompetition}
        activeSection={section}
        isAdmin={currentUser?.isAdmin ?? false}
      />

      {/* ── Bouton EN DIRECT — uniquement sur le Globe (discret quand inactif, rouge quand un match est en direct) ── */}
      {/* Sur la page Paris le match en direct est déjà mis en avant tout en haut, inutile d'y remettre le bouton. */}
      {section === 'globe' && (() => {
        const isLive = liveIds.length > 0
        return (
          <button onClick={goToLive} title={isLive ? 'Voir le match en direct' : 'Aucun match en direct'} style={{
            position: 'fixed', top: 'calc(var(--header-h) + var(--sat) + 8px)',
            left: '50%', transform: 'translateX(-50%)', zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: isLive ? '6px 12px' : '5px 10px', borderRadius: 999, cursor: 'pointer',
            background: isLive ? 'linear-gradient(135deg,#e11d48,#dc2626)' : 'var(--bg-card)',
            border: isLive ? 'none' : '1px solid var(--border)',
            color: isLive ? '#fff' : 'var(--text-3)',
            fontSize: isLive ? 11 : 10, fontWeight: 800, letterSpacing: 0.4,
            boxShadow: isLive ? '0 6px 20px rgba(220,38,38,0.45)' : 'var(--shadow-sm)',
            opacity: isLive ? 1 : 0.7,
            animation: isLive ? 'livePulse 1.6s ease-in-out infinite' : 'none',
            transition: 'all 0.25s',
          }}>
            <span style={{
              width: isLive ? 8 : 6, height: isLive ? 8 : 6, borderRadius: '50%',
              background: isLive ? '#fff' : 'var(--text-3)',
              animation: isLive ? 'liveDot 1s ease-in-out infinite' : 'none',
            }} />
            {isLive ? `EN DIRECT${liveIds.length > 1 ? ` · ${liveIds.length}` : ''}` : 'Direct'}
          </button>
        )
      })()}

      {mentionToast && (
        <div
          onClick={() => { setMentionToast(null); openChat() }}
          style={{
            position: 'fixed', top: 'calc(var(--sat) + 10px)', left: 12, right: 12, zIndex: 500,
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '12px 14px', borderRadius: 14,
            background: 'linear-gradient(135deg,#C89B3C,#E8D080)', color: '#0D0800',
            boxShadow: '0 6px 24px rgba(0,0,0,0.25)', animation: 'fadeSlideUp 0.25s ease',
          }}
        >
          <span style={{ fontSize: 18 }}>💬</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{mentionToast.pseudo} t'a mentionné</div>
            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mentionToast.body}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>Ouvrir ›</span>
        </div>
      )}

      {/* ── Chat (panneau sur l'accueil) ──────────────────────── */}
      <ChatSheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        currentUser={currentUser}
        onOpenAuth={openAuth}
        onOpenProfile={openProfileFromChat}
        online={online}
      />

      {/* ── Boîte de réception ────────────────────────────────── */}
      <NotificationInbox
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        notifications={notifications}
        onSelect={onSelectNotification}
      />

      {/* ── Bandeau « nouvelle version disponible » ───────────── */}
      <UpdateBanner />

      {/* ── Auth modal ────────────────────────────────────────── */}
      {showAuth && (
        <AuthModal onSuccess={handleAuth} onClose={() => setShowAuth(false)} />
      )}

      {/* ── Réinitialisation du mot de passe (arrivée depuis le lien e-mail) ── */}
      {recovery.active && (
        <ResetPasswordModal onClose={() => setRecovery({ active: false })} />
      )}

      {/* ── Profile modal ─────────────────────────────────────── */}
      {showProfile && currentUser && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfile(false)}
          onLogout={handleLogout}
          onUpdated={(u) => {
            setCurrentUser(u)
            setViewedPlayer(vp => vp && vp.player.id === u.id ? { ...vp, player: u } : vp)
          }}
        />
      )}
    </div>
  )
}
