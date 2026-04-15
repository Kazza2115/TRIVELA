import { useState, useRef } from 'react'
import Globe        from './components/Globe'
import Paris        from './pages/Paris'
import Classement   from './pages/Classement'
import MonAlbum     from './pages/MonAlbum'
import MesPacks     from './pages/MesPacks'
import AuthModal    from './components/AuthModal'
import ProfileModal from './components/ProfileModal'
import TrivelaLogo  from './components/TrivelaLogo'
import { getSession } from './services/auth'
import type { UserProfile } from './services/auth'
import {
  IconGlobe, IconTrophy, IconPacks, IconAlbum, IconBolt,
} from './components/NavIcons'
import './index.css'

export type SectionId = 'globe' | 'paris' | 'classement' | 'album' | 'packs'

const NAV_ITEMS: {
  id: SectionId; Icon: React.FC<{ size?: number; color?: string }>
  label: string; countryId: number | null
  countryCode?: string; countryName?: string; sectionName?: string
}[] = [
  { id: 'paris',      Icon: IconBolt,   label: 'Paris',      countryId: 840, countryCode: 'us', countryName: 'USA',      sectionName: 'Paris'       },
  { id: 'album',      Icon: IconAlbum,  label: 'Album',      countryId: 724, countryCode: 'es', countryName: 'Espagne',  sectionName: 'Mon Album'   },
  { id: 'globe',      Icon: IconGlobe,  label: 'Globe',      countryId: null },
  { id: 'packs',      Icon: IconPacks,  label: 'Packs',      countryId: 76,  countryCode: 'br', countryName: 'Brésil',   sectionName: 'Mes Packs'   },
  { id: 'classement', Icon: IconTrophy, label: 'Classement', countryId: 686, countryCode: 'sn', countryName: 'Sénégal',  sectionName: 'Classement'  },
]

// Funnel: all items stay within the nav band — outer items touch the top edge
const FUNNEL_BOTTOM_PX = [14, 8, 2, 8, 14]

export default function App() {
  const [section,     setSection]     = useState<SectionId>('globe')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getSession())
  const [showAuth,    setShowAuth]    = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  // ── Parier banner — smooth swipe-to-dismiss ────────────────────────────────
  // bannerShown drives the CSS transition (always rendered, never unmounted).
  // dragOffset follows the finger in real time; when it resets to 0 the CSS
  // transition springs it back (or finishes the dismiss).
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
    setDragOffset(0)          // always reset → triggers spring-back OR final dismiss
    if (dy > 52) setBannerShown(false)
  }

  const [activeNav, setActiveNav] = useState<SectionId>('globe')

  const back         = () => { setSection('globe'); setActiveNav('globe') }
  const openAuth     = () => setShowAuth(true)
  const handleAuth   = (user: UserProfile) => { setCurrentUser(user); setShowAuth(false) }
  const handleLogout = () => { setCurrentUser(null); setShowProfile(false) }
  // Globe calls this after its dive animation finishes
  const navigateTo   = (s: string) => { setSection(s as SectionId); setActiveNav(s as SectionId) }

  const gold   = '#C89B3C'
  const dimCol = '#AEAEB2'

  // Derived banner style values
  const bannerTranslate = bannerShown ? dragOffset : 130
  const bannerOpacity   = bannerShown ? Math.max(0, 1 - dragOffset / 100) : 0
  const bannerTransition = dragOffset > 0
    ? 'none'
    : 'transform 0.44s cubic-bezier(0.34,1.15,0.64,1), opacity 0.36s ease'

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',                   // needed for absolute nav
      paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)',
      paddingLeft: 'var(--sal)', paddingRight: 'var(--sar)',
    }}>
      {/* ── Header ────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0, height: 'var(--header-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 10,
        background: 'rgba(242,242,247,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(60,60,67,0.14)',
      }}>
        <button onClick={() => setSection('globe')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 2px', borderRadius: 8, transition: 'opacity 0.18s',
          display: 'flex', alignItems: 'center',
        }}
          onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
          onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
        >
          <TrivelaLogo size={110} color={gold} />
        </button>

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
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', maxWidth: 80,
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
      </header>

      {/* ── Content ── fills edge-to-edge; nav floats on top via position:absolute */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>

        {/* Globe — D3 projection zoom drives the dive; no CSS scale = no blur */}
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

            {/* ── Parier banner — always mounted, CSS transition for show/hide ── */}
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
                // Smooth slide driven by dragOffset (during drag) or bannerShown (transition)
                transition: bannerTransition,
                transform: `translateY(${bannerTranslate}px)`,
                opacity: bannerOpacity,
                pointerEvents: bannerShown ? 'auto' : 'none',
              }}
            >
              {/* Drag handle pill */}
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

            {/* ── Restore pill — slides up from below when banner is hidden ── */}
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

        {section === 'album'      && <MonAlbum  onBack={back} />}
        {section === 'packs'      && <MesPacks  onBack={back} />}
        {section === 'paris'      && <Paris      onBack={back} currentUser={currentUser} />}
        {section === 'classement' && (
          <Classement onBack={back} currentUser={currentUser} onOpenAuth={openAuth} />
        )}
      </div>

      {/* ── Bottom nav — funnel shape ─────────────────────────── */}
      {/* Flex item so it creates a deliberate (small) separator band.
          overflow:visible lets outer items float above the band.
          z-index:20 keeps them painted above the content (z-index:1). */}
      <nav style={{
        flexShrink: 0,
        height: 72,
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(242,242,247,0.92)',
        borderTop: '1px solid rgba(60,60,67,0.10)',
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        zIndex: 20,
      }}>
        {NAV_ITEMS.map(({ id, Icon, label }, idx) => {
          const active    = activeNav === id
          const bottomPx  = FUNNEL_BOTTOM_PX[idx]
          const leftPct   = (idx + 0.5) * 20      // 10%, 30%, 50%, 70%, 90%
          const isGlobe   = id === 'globe'

          return (
            <button key={id}
              onClick={() => {
                setActiveNav(id)
                setSection(id)
              }}
              style={{
                position: 'absolute',
                bottom: bottomPx,
                left: `${leftPct}%`,
                transform: 'translateX(-50%)',
                width: 64,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                background: active
                  ? 'rgba(200,155,60,0.10)'
                  : 'rgba(242,242,247,0.94)',
                border: active
                  ? `1px solid ${gold}55`
                  : '1px solid rgba(60,60,67,0.13)',
                borderRadius: 14,
                backdropFilter: 'saturate(180%) blur(20px)',
                WebkitBackdropFilter: 'saturate(180%) blur(20px)',
                boxShadow: active
                  ? `0 2px 10px ${gold}22`
                  : '0 1px 6px rgba(0,0,0,0.07)',
                cursor: 'pointer',
                padding: '8px 4px 7px',
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
