import type { Tab } from './TabBar'
import { TabIcon } from './TabIcons'

interface Props {
  title: string
  count?: number
  icon?: Tab
}

export default function ScreenTitle({ title, count, icon }: Props) {
  return (
    <h2 className="mb-5 flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
      {icon && (
        <span style={{ color: 'var(--accent)' }}>
          <TabIcon tab={icon} className="h-6 w-6 shrink-0" />
        </span>
      )}
      <span>{title}</span>
      {count !== undefined && (
        <span className="text-base font-medium tabular-nums text-[#8b8392]">({count})</span>
      )}
    </h2>
  )
}