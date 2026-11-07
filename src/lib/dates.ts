// small date helpers shared across screens

// today as YYYY-MM-DD in your own time zone (TMDB dates use the same format)
export const todayStr = () => new Date().toLocaleDateString('en-CA')

// "just now", "5 min ago", "3 h ago", "2 d ago"
export function ago(ms: number) {
  const min = Math.round((Date.now() - ms) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}
