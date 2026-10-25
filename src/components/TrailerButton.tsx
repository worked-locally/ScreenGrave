import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { trailerKey, type Title } from '../lib/tmdb'

export default function TrailerButton({ title }: { title: Title }) {
  const [key, setKey] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setKey(null)
    trailerKey(title.type, title.id)
      .then((k) => !cancelled && setKey(k))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [title.type, title.id])

  if (!key) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-5 flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-medium transition-transform active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" style={{ color: 'var(--accent)' }}>
          <path d="M8 5v14l11-7z" />
        </svg>
        Trailer
      </button>

      {open &&
        createPortal(
          <div
            className="anim-fade fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-4"
            onClick={() => setOpen(false)}
          >
            <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${key}?autoplay=1&playsinline=1&rel=0`}
                  title={`${title.title} trailer`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
              <div className="mt-3 flex justify-between text-sm text-[#8b8392]">
                <a href={`https://www.youtube.com/watch?v=${key}`} target="_blank" rel="noreferrer">
                  Open on YouTube
                </a>
                <button onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}