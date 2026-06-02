import { useState, useRef, useEffect } from 'react'
import Globe        from './components/Globe'
import Paris        from './pages/Paris'
import Classement   from './pages/Classement'
import Actualites   from './pages/Actualites'
import AuthModal    from './components/AuthModal'
import ProfileModal from './components/ProfileModal'
import MenuDrawer   from './components/MenuDrawer'
import TrivelaLogo  from './components/TrivelaLogo'
import { subscribeToAuth } from './services/auth'
import type { UserProfile } from './services/auth'
import {
  IconGlobe, IconTrophy, IconBolt,
} from './components/NavIcons'
import './index.css'

export type SectionId = 'globe' | 'paris' | 'classement' | 'actualites'

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
  const [darkMode,    setDarkMode]    = useState(() => {
    try { return localStorage.getItem('trivela-theme') === 'dark' } catch { return false }
  })

  useEffect(() => subscribeToAuth(setCurrentUser), [])

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

  // ── Parier banner — smooth swipe-to-dismiss ────────────────────────────────
  const [bannerShown,  setBannerShown]  = useState(true)
  const [dragOffset,   setDragOffset]   = useState(0)
  const swipeRef = useRef({ active: false, startY: 0 })

  const handleBannerTouchStart = (e: React.TouchEvent) => {
    if (!bannerShown) return
    swipeRef.current = { active: true, startY: e.touches[0].clientY }
  }
  const handleBannerTouchMove = (e: React.TouchEvent) => {
    if (!swipeRef.current.active) return
    const dy = Math.max(0, e.touches[0].clientY - swipeRef.current.startY)
    setDragOffset(Math.min(dy * 0.8, 120))
  }
  const handleBannerTouchEnd = (e: React.TouchEvent) => {
    if (!swipeRef.current.active) return
    swipeRef.current.active = false
    const dy = e.changedTouches[0].clientY - swipeRef.current.startY
    setDragOffset(0)
    if (dy > 52) setBannerShown(false)
  }

  const [activeNav, setActiveNav] = useState<SectionId>('globe')

  const back       = () => { setSection('globe'); setActiveNav('globe') }
  const openAuth   = () => setShowAuth(true)
  const handleAuth = (user: UserProfile) => { setCurrentUser(user); setShowAuth(false) }
  const handleLogout = () => { setCurrentUser(null); setShowProfile(false) }
  const navigateTo   = (s: string) => { setSection(s as SectionId); setActiveNav(s as SectionId) }
  const navigateMenu = (s: SectionId) => { setSection(s) }

  const gold   = '#C89B3C'
  const dimCol = '#AEAEB2'

  const bannerTranslate  = bannerShown ? dragOffset : 130
  const bannerOpacity    = bannerShown ? Math.max(0, 1 - dragOffset / 100) : 0
  const bannerTransition = dragOffset > 0
    ? 'none'
    : 'transform 0.44s cubic-bezier(0.34,1.15,0.64,1), opacity 0.36s ease'

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

        {/* Center: logo — absolutely centered */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'auto',
        }}>
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
            <TrivelaLogo size={110} color={gold} />
          </button>
        </div>

        {/* Right: theme toggle + user */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
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

          {/* User / login */}
          {currentUser ? (
            <button onClick={() => setShowProfile(true)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 20, padding: '5px 10px 5px 6px',
              cursor: 'pointer', transition: 'opacity 0.15s',
            }}
              onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
              onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
            >
              <img src={`https://flagcdn.com/w40/${currentUser.countryCode}.png`}
                alt={currentUser.countryName}
                style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', maxWidth: 72,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.pseudo}
              </span>
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
          <Globe onNavigate={navigateTo} isActive={section === 'globe'} />

          <p style={{
            position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center',
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--text-3)', pointerEvents: 'none', fontWeight: 600,
            animation: 'fadeIn 2s ease 1.5s both',
          }}>
            Touchez un pays · Faites pivoter
          </p>

          {/* Parier banner */}
          <div
            onTouchStart={handleBannerTouchStart}
            onTouchMove={handleBannerTouchMove}
            onTouchEnd={handleBannerTouchEnd}
            style={{
              position: 'absolute', bottom: 16, left: 16, right: 16,
              padding: '20px 18px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 20,
              boxShadow: 'var(--shadow-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              touchAction: 'none',
              transition: bannerTransition,
              transform: `translateY(${bannerTranslate}px)`,
              opacity: bannerOpacity,
              pointerEvents: bannerShown ? 'auto' : 'none',
            }}
          >
            <div style={{
              position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
              width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.10)',
              pointerEvents: 'none',
            }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: gold,
                textTransform: 'uppercase', marginBottom: 3 }}>
                Coupe du Monde 2026
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>
                72 matchs · Faites vos pronostics
              </div>
            </div>
            <button onClick={() => navigateTo('paris')} style={{
              padding: '10px 18px',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              border: 'none', borderRadius: 12, color: '#0D0800', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
              boxShadow: '0 4px 14px rgba(200,155,60,0.4)',
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(200,155,60,0.25)' }}
              onPointerUp={e   => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = '0 4px 14px rgba(200,155,60,0.4)' }}
            >
              Parier →
            </button>
          </div>

          {/* Restore pill */}
          <button
            onClick={() => setBannerShown(true)}
            style={{
              position: 'absolute', bottom: 16, right: 16,
              padding: '9px 18px',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              border: 'none', borderRadius: 20,
              color: '#0D0800', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(200,155,60,0.4)',
              transition: 'opacity 0.36s ease, transform 0.44s cubic-bezier(0.34,1.15,0.64,1)',
              opacity: bannerShown ? 0 : 1,
              transform: bannerShown ? 'translateY(50px)' : 'translateY(0)',
              pointerEvents: bannerShown ? 'none' : 'auto',
            }}
          >
            ⚡ Parier
          </button>
        </div>

        {section === 'actualites' && <Actualites  onBack={back} />}
        {section === 'paris'      && <Paris        onBack={back} currentUser={currentUser} onOpenAuth={openAuth} />}
        {section === 'classement' && (
          <Classement onBack={back} currentUser={currentUser} onOpenAuth={openAuth} />
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
              onClick={() => { setActiveNav(id); setSection(id) }}
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
        activeSection={section}
      />

      {/* ── Auth modal ────────────────────────────────────────── */}
      {showAuth && (
        <AuthModal onSuccess={handleAuth} onClose={() => setShowAuth(false)} />
      )}

      {/* ── Profile modal ─────────────────────────────────────── */}
      {showProfile && currentUser && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfile(false)}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}
