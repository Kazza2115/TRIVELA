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

// Funnel heights: distance from nav bottom — outer items sit highest on screen
const FUNNEL_BOTTOM_PX = [52, 28, 6, 28, 52]

export default function App() {
  const [section,     setSection]     = useState<SectionId>('globe')
  const [centerRequest, setCenterRequest] = useState<{ id: number; ts: number } | null>(null)
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

  // ── Country flag flash on nav tap ──────────────────────────────────────────
  const [flagFlash, setFlagFlash] = useState<{
    code: string; countryName: string; sectionName: string
  } | null>(null)

  const [activeNav, setActiveNav] = useState<SectionId>('globe')

  const back         = () => { setSection('globe'); setActiveNav('globe') }
  const openAuth     = () => setShowAuth(true)
  const handleAuth   = (user: UserProfile) => { setCurrentUser(user); setShowAuth(false) }
  const handleLogout = () => { setCurrentUser(null); setShowProfile(false) }
  const navigateTo   = (s: string) => setSection(s as SectionId)

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

      {/* ── Content ── paddingBottom reserves space above the floating nav */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1, paddingBottom: 100 }}>

        {/* Globe — always mounted so it never reloads; hidden when in another section */}
        <div style={{
          width: '100%', height: '100%', position: 'relative', background: 'var(--bg)',
          display: section === 'globe' ? 'block' : 'none',
        }}>
          <Globe onNavigate={navigateTo} centerRequest={centerRequest} isActive={section === 'globe'} />

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
              <button onClick={() => {
                setCenterRequest({ id: 840, ts: Date.now() })
                setTimeout(() => {
                  setFlagFlash({ code: 'us', countryName: 'USA', sectionName: 'Paris' })
                  setSection('paris')
                  setTimeout(() => setFlagFlash(null), 1000)
                }, 900)
              }} style={{
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
      {/* Nav floats over the content (position absolute) so no grey band shows
          behind the cards. activeNav tracks what the user tapped immediately,
          so Globe doesn't flash gold during the 900ms globe-spin transition. */}
      <nav style={{
        position: 'absolute',
        bottom: 'var(--sab)',
        left: 0, right: 0,
        height: 100,
        zIndex: 20,
      }}>
        {NAV_ITEMS.map(({ id, Icon, label, countryId, countryCode, countryName, sectionName }, idx) => {
          const active    = activeNav === id
          const onGlobe   = section === 'globe'   // glass card only when globe bg is dark
          const bottomPx  = FUNNEL_BOTTOM_PX[idx]
          const leftPct   = (idx + 0.5) * 20      // 10%, 30%, 50%, 70%, 90%
          const isGlobe   = id === 'globe'

          return (
            <button key={id}
              onClick={() => {
                setActiveNav(id)
                if (countryId === null) { setSection('globe'); return }
                if (!countryCode || !sectionName) { setSection(id); return }

                setSection('globe')
                setCenterRequest({ id: countryId, ts: Date.now() })
                setTimeout(() => {
                  setFlagFlash({ code: countryCode, countryName: countryName ?? '', sectionName })
                  setSection(id)
                  setTimeout(() => setFlagFlash(null), 1000)
                }, 900)
              }}
              style={{
                position: 'absolute',
                bottom: bottomPx,
                left: `${leftPct}%`,
                transform: 'translateX(-50%)',
                width: 64,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                // On globe (dark bg): glass card. On other pages: invisible card, just icon+label
                background: active
                  ? 'rgba(200,155,60,0.10)'
                  : onGlobe ? 'rgba(242,242,247,0.94)' : 'transparent',
                border: active
                  ? `1px solid ${gold}55`
                  : onGlobe ? '1px solid rgba(60,60,67,0.13)' : 'none',
                borderRadius: 14,
                backdropFilter: onGlobe || active ? 'saturate(180%) blur(20px)' : 'none',
                WebkitBackdropFilter: onGlobe || active ? 'saturate(180%) blur(20px)' : 'none',
                boxShadow: active
                  ? `0 2px 10px ${gold}22`
                  : onGlobe ? '0 1px 6px rgba(0,0,0,0.07)' : 'none',
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

      {/* ── Section flash overlay ─────────────────────────────────
           Shows the section name + country flag when tapping a nav item.
           Each child has its own staggered entrance animation.          ── */}
      {flagFlash && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
          background: 'rgba(8,16,32,0.97)',
          animation: 'flagEnter 1000ms ease-in-out forwards',
          pointerEvents: 'none',
        }}>
          {/* Section name — hero element, slides up with bounce */}
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 52, letterSpacing: 6,
            color: '#E8D080', lineHeight: 1,
            textAlign: 'center',
            animation: 'fadeSlideUp 0.42s cubic-bezier(0.34,1.2,0.64,1) 0.05s both',
          }}>
            {flagFlash.sectionName}
          </div>

          {/* Country flag — scales in slightly after the title */}
          <img
            src={`https://flagcdn.com/w640/${flagFlash.code}.png`}
            alt={flagFlash.countryName}
            style={{
              width: 200, height: 'auto',
              borderRadius: 12,
              boxShadow: '0 16px 56px rgba(0,0,0,0.60)',
              border: '2px solid rgba(255,255,255,0.14)',
              animation: 'scaleIn 0.38s cubic-bezier(0.34,1.2,0.64,1) 0.16s both',
            }}
          />

          {/* Country name — small caption, fades in last */}
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 3,
            color: 'rgba(255,255,255,0.38)',
            textTransform: 'uppercase',
            animation: 'fadeIn 0.32s ease 0.28s both',
          }}>
            {flagFlash.countryName}
          </div>
        </div>
      )}

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
