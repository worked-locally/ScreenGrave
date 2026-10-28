export default function Divider({ text }: { text: string }) {
  return (
    <div role="separator" className="my-4 flex shrink-0 items-center gap-3">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#8b8392]">
        <span style={{ color: 'var(--accent)' }}>✦</span>
        {text}
        <span style={{ color: 'var(--accent)' }}>✦</span>
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
    </div>
  )
}