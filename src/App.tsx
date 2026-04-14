import { useState } from 'react'
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
}[] = [
  { id: 'globe',      Icon: IconGlobe,  label: 'Globe',      countryId: null },
  { id: 'album',      Icon: IconAlbum,  label: 'Album',      countryId: 724  },
  { id: 'packs',      Icon: IconPacks,  label: 'Packs',      countryId: 76   },
  { id: 'paris',      Icon: IconBolt,   label: 'Paris',      countryId: 840  },
  { id: 'classement', Icon: IconTrophy, label: 'Classement', countryId: 686  },
]

export default function App() {
  const [section,       setSection]       = useState<SectionId>('globe')
  const [centerRequest, setCenterRequest] = useState<{ id: number; ts: number } | null>(null)
  const [currentUser,   setCurrentUser]   = useState<UserProfile | null>(() => getSession())
  const [showAuth,      setShowAuth]      = useState(false)
  const [showProfile,   setShowProfile]   = useState(false)

  const back         = () => setSection('globe')
  const openAuth     = () => setShowAuth(true)
  const handleAuth   = (user: UserProfile) => { setCurrentUser(user); setShowAuth(false) }
  const handleLogout = () => { setCurrentUser(null); setShowProfile(false) }

  const navigateTo = (s: string) => setSection(s as SectionId)

  const gold   = '#C89B3C'
  const dimCol = '#AEAEB2'

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
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
        {/* Logo */}
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

        {/* Auth area */}
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

      {/* ── Content ───────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>

        {section === 'globe' && (
          <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--bg)' }}>
            <Globe onNavigate={navigateTo} centerRequest={centerRequest} />

            <p style={{
              position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center',
              fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
              color: 'var(--text-3)', pointerEvents: 'none', fontWeight: 600,
              animation: 'fadeIn 2s ease 1.5s both',
            }}>
              Touchez un pays · Faites pivoter
            </p>

            <div style={{
              position: 'absolute', bottom: 16, left: 16, right: 16,
              padding: '16px 18px', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 20,
              boxShadow: 'var(--shadow-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              animation: 'fadeSlideUp .5s cubic-bezier(0.4,0,0.2,1) .8s both',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: gold,
                  textTransform: 'uppercase', marginBottom: 3 }}>
                  Coupe du Monde 2026
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>
                  72 matchs · Faites vos pronostics
                </div>
              </div>
              <button onClick={() => setSection('paris')} style={{
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
          </div>
        )}

        {section === 'album'      && <MonAlbum  onBack={back} />}
        {section === 'packs'      && <MesPacks  onBack={back} />}
        {section === 'paris'      && <Paris      onBack={back} currentUser={currentUser} />}
        {section === 'classement' && (
          <Classement onBack={back} currentUser={currentUser} onOpenAuth={openAuth} />
        )}
      </div>

      {/* ── Bottom nav ────────────────────────────────────────── */}
      <nav style={{
        flexShrink: 0, height: 'var(--nav-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        background: 'rgba(242,242,247,0.92)',
        borderTop: '1px solid rgba(60,60,67,0.14)',
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        zIndex: 20,
      }}>
        {NAV_ITEMS.map(({ id, Icon, label, countryId }) => {
          const active = section === id
          return (
            <button key={id}
              onClick={() => {
                if (countryId !== null) {
                  setSection('globe')
                  setCenterRequest({ id: countryId, ts: Date.now() })
                  // After centering, navigate (slight delay for globe animation)
                  setTimeout(() => setSection(id), 900)
                } else {
                  setSection(id)
                }
              }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 4px', borderRadius: 12, transition: 'opacity 0.15s',
              }}
              onPointerDown={e => (e.currentTarget.style.opacity = '0.45')}
              onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
            >
              <Icon size={22} color={active ? gold : dimCol} />
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: 0.4,
                color: active ? gold : dimCol, textTransform: 'uppercase',
                transition: 'color 0.2s',
              }}>{label}</span>
              {active && <div style={{ width: 16, height: 2, borderRadius: 1, background: gold }} />}
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
