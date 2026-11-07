import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { blocks, type Block } from '../lib/reel'

// The long view: slow scroll on black, then a short scene for anyone who waits.

const SPEED = 38 // pixels per second

const css = `
@keyframes roll-up { from { transform: translateY(var(--from)); } to { transform: translateY(var(--to)); } }
@keyframes roll-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes roll-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes roll-wink { 0%, 100% { transform: scaleY(1); } 45%, 60% { transform: scaleY(0.08); } }
@keyframes roll-glint { 0% { opacity: 0; transform: scale(0.2) rotate(0); } 40% { opacity: 1; transform: scale(1) rotate(45deg); } 100% { opacity: 0; transform: scale(0.6) rotate(90deg); } }
@media (prefers-reduced-motion: reduce) { .roll-motion { animation: none !important; } }
`

const role: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: '#8b8392',
  margin: 0,
}
const name: CSSProperties = { fontSize: 20, fontWeight: 600, color: '#efe9df', margin: '6px 0 30px' }
const joke: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.6,
  fontStyle: 'italic',
  color: '#cdc6bd',
  margin: '0 auto 44px',
  maxWidth: 320,
}

function Item({ b }: { b: Block }) {
  switch (b[0]) {
    case 'h':
      return (
        <div style={{ marginBottom: 90 }}>
          <p style={{ ...role, marginBottom: 14 }}>An after-hours picture</p>
          <p style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: '#efe9df' }}>
            Screen<span style={{ color: '#ff9f45' }}>Grave</span>
          </p>
        </div>
      )
    case 's':
      return <div style={{ height: 80 }} />
    case 'r':
      return (
        <div>
          <p style={role}>{b[1]}</p>
          <p style={name}>{b[2]}</p>
        </div>
      )
    case 'j':
      return <p style={joke}>{b[1]}</p>
    case 'e':
      return <p style={{ fontSize: 22, fontWeight: 600, color: '#efe9df', margin: '40px 0 0' }}>{b[1]}</p>
  }
}

function Tomb() {
  return (
    <div style={{ position: 'relative', width: 112, height: 112, margin: '0 auto' }}>
      <svg viewBox="0 0 512 512" width="112" height="112" aria-hidden="true">
        <defs>
          <linearGradient id="roll-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffb46b" />
            <stop offset="1" stopColor="#ff8a2a" />
          </linearGradient>
          <clipPath id="roll-tomb">
            <path d="M156 380V216c0-55.2 44.8-100 100-100s100 44.8 100 100v164z" />
          </clipPath>
        </defs>
        <path d="M156 380V216c0-55.2 44.8-100 100-100s100 44.8 100 100v164z" fill="url(#roll-g)" />
        <g clipPath="url(#roll-tomb)">
          {[156, 196, 236, 276, 316].map((x) => (
            <rect key={x} x={x} y="276" width="20" height="104" fill="#efe9df" />
          ))}
          <rect x="156" y="270" width="200" height="8" fill="#e06d18" />
        </g>
        {/* the play button doubles as an eye */}
        <path
          className="roll-motion"
          d="M233.3 158.0v84l68.0 -42.0z"
          fill="#0c0a0f"
          style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'roll-wink 420ms ease-in-out 4.3s 1 both' }}
        />
        <rect x="116" y="380" width="280" height="14" rx="7" fill="#3fb9a8" />
      </svg>
      <span
        className="roll-motion"
        style={{
          position: 'absolute',
          right: 14,
          top: 12,
          width: 14,
          height: 14,
          background: 'radial-gradient(circle, #fff6e0 0 20%, transparent 22%), linear-gradient(#ffcf8a, #ffcf8a) center/2px 100% no-repeat, linear-gradient(#ffcf8a, #ffcf8a) center/100% 2px no-repeat',
          opacity: 0,
          animation: 'roll-glint 700ms ease-out 4.45s 1 both',
        }}
      />
    </div>
  )
}

export default function Roll({ onClose }: { onClose: () => void }) {
  const list = useMemo(() => blocks(), [])
  const reel = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(0)
  const [post, setPost] = useState(false)
  const [closable, setClosable] = useState(false)
  const calm = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // the scroll takes as long as the credits are tall
  useLayoutEffect(() => {
    const h = reel.current?.offsetHeight ?? 0
    setDuration((window.innerHeight + h) / SPEED)
  }, [])

  // keep the page behind still, and let Escape close it
  useEffect(() => {
    const body = document.body
    const prev = body.style.overflow
    body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    if (!post) return
    const t = window.setTimeout(() => setClosable(true), 7000)
    return () => window.clearTimeout(t)
  }, [post])

  return (
    <div
      role="dialog"
      aria-label="Credits"
      onClick={() => post && closable && onClose()}
      className="roll-motion"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        background: '#000',
        color: '#efe9df',
        overflow: calm ? 'auto' : 'hidden',
        textAlign: 'center',
        fontFamily: 'inherit',
        animation: 'roll-in 800ms ease-out both',
      }}
    >
      <style>{css}</style>

      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top) + 12px)',
          right: 12,
          zIndex: 1,
          width: 44,
          height: 44,
          borderRadius: 9999,
          border: 0,
          background: 'rgba(255,255,255,0.06)',
          color: '#8b8392',
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>

      {!post && (
        <div
          ref={reel}
          className="roll-motion"
          onAnimationEnd={(e) => e.target === e.currentTarget && setPost(true)}
          style={
            {
              padding: calm ? '96px 24px 48px' : '0 24px',
              '--from': '100vh',
              '--to': '-100%',
              animation: duration && !calm ? `roll-up ${duration}s linear 1s both` : undefined,
              willChange: 'transform',
            } as CSSProperties
          }
        >
          {list.map((b, i) => (
            <Item key={i} b={b} />
          ))}
          {calm && (
            <button
              onClick={() => setPost(true)}
              style={{ marginTop: 40, background: 'none', border: 0, color: '#8b8392', fontSize: 13 }}
            >
              Stay for the scene after the credits
            </button>
          )}
        </div>
      )}

      {post && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
          }}
        >
          <div className="roll-motion" style={{ animation: 'roll-in 1200ms ease-out 2.5s both' }}>
            <Tomb />
          </div>
          <p
            className="roll-motion"
            style={{ margin: 0, fontSize: 17, color: '#cdc6bd', animation: 'roll-rise 900ms ease-out 5s both' }}
          >
            ScreenGrave will return in 1.1.
          </p>
          <p
            className="roll-motion"
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#6b6473',
              animation: 'roll-in 900ms ease-out 7s both',
            }}
          >
            Tap anywhere to close
          </p>
        </div>
      )}
    </div>
  )
}
