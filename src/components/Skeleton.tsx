// Soft placeholder shapes while posters load, instead of "Loading…" text.

export function PosterSkeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton aspect-[2/3] w-full rounded-xl ${className}`} aria-hidden="true" />
}

export function SkeletonGrid({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </div>
  )
}

// a heading and a few posters, matching the For You rows
export function SkeletonRow() {
  return (
    <section className="mb-6" aria-hidden="true">
      <div className="skeleton mb-2.5 h-4 w-44 rounded-full" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="w-[7.25rem] shrink-0">
            <PosterSkeleton />
          </div>
        ))}
      </div>
    </section>
  )
}

// three cases, the middle one up front, roughly where the trending carousel will appear
export function CarouselSkeleton() {
  return (
    <div className="-mx-4 flex items-center justify-center gap-2 overflow-hidden py-6" aria-hidden="true">
      <div className="w-[150px] shrink-0 scale-[0.84] opacity-60">
        <PosterSkeleton />
      </div>
      <div className="w-[150px] shrink-0">
        <PosterSkeleton />
      </div>
      <div className="w-[150px] shrink-0 scale-[0.84] opacity-60">
        <PosterSkeleton />
      </div>
    </div>
  )
}
