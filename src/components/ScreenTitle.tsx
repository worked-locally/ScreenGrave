interface Props {
  title: string
  count?: number
}

export default function ScreenTitle({ title, count }: Props) {
  return (
    <h2 className="mb-5 flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
      <span>{title}</span>
      {count !== undefined && (
        <span className="text-base font-medium tabular-nums text-[#8b8392]">({count})</span>
      )}
    </h2>
  )
}