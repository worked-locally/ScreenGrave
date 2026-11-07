import { useShowState } from '../lib/showstate'
import type { Title } from '../lib/tmdb'

// top-left of a poster: "Ended" or "Canceled". Running shows stay unlabeled.
export default function ShowStateLabel({ title }: { title: Title }) {
  const s = useShowState(title)
  if (s?.state !== 'ended' && s?.state !== 'canceled') return null
  return (
    <span className="pointer-events-none absolute left-1.5 top-1.5 max-w-[calc(100%-2.25rem)] truncate rounded-md bg-black/55 px-1.5 py-1 text-[10px] font-medium leading-none text-[#cdc6bd] backdrop-blur-sm">
      {s.state === 'ended' ? 'Ended' : 'Canceled'}
    </span>
  )
}
