import { useEffect, useState } from 'react'
import { FEATURED } from './Globe'
import { COMPETITIONS } from '../data/continentStats'

interface Props {
  countryId: number
  onNavigate: (conf: string) => void
  onClose: () => void
}

export default function CountryPopup({ countryId, onNavigate, onClose }: Props) {
  const country = FEATURED[countryId]
  const comp = country ? COMPETITIONS[country.conf] : undefined
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Slight delay so the flag transition plays first
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  if (!country) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 260,
        zIndex: 100,
        opacity: visible ? 1 : 0,
        // Translate to center horizontally and sit above the anchor point
        transform: visible
          ? 'translate(-50%, calc(-100% - 20px)) scale(1)'
          : 'translate(-50%, calc(-100% - 8px)) scale(0.92)',
        transition: 'opacity 0.35s cubic-bezier(0.34,1.56,0.64,1), transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: visible ? 'all' : 'none',
      }}
    >
      {/* Glass card — no glow, clean shadow */}
      <div style={{
        background: 'rgba(8, 18, 38, 0.90)',
        border: `1.5px solid ${country.color}55`,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Color banner */}
        <div style={{
          height: 5,
          background: `linear-gradient(90deg, ${country.color} 0%, ${country.color}88 100%)`,
        }} />

        <div style={{ padding: '16px 18px 18px' }}>
          {/* Flag + country name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <img
              src={`https://flagcdn.com/w80/${country.code}.png`}
              alt={`Drapeau ${country.name}`}
              style={{
                width: 48, height: 32,
                objectFit: 'cover',
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
            <div>
              <div style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: 22,
                letterSpacing: 2,
                color: '#fff',
                lineHeight: 1,
              }}>
                {country.name}
              </div>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.5,
                color: country.color,
                textTransform: 'uppercase',
                marginTop: 2,
              }}>
                Coupe du Monde 2026
              </div>
            </div>
          </div>

          {/* Section badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: `${country.color}14`,
            borderRadius: 10,
            border: `1px solid ${country.color}33`,
            marginBottom: 14,
          }}>
            <span style={{ fontSize: 18 }}>{comp?.emoji ?? country.icon}</span>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 1 }}>
                {comp ? comp.region.toUpperCase() : 'STATISTIQUES'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {comp?.competition ?? 'Statistiques'}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onNavigate(country.conf)}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: `linear-gradient(135deg, ${country.color} 0%, ${country.color}bb 100%)`,
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                ;(e.currentTarget as HTMLButtonElement).style.opacity = '0.88'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLButtonElement).style.opacity = '1'
              }}
            >
              Explorer →
            </button>
            <button
              onClick={onClose}
              style={{
                width: 40,
                height: 40,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: 'rgba(255,255,255,0.5)',
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Arrow pointing down toward centroid */}
      <div style={{
        position: 'absolute',
        bottom: -8,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: `8px solid ${country.color}55`,
      }} />
    </div>
  )
}
