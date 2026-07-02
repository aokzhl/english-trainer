import type { ReactNode } from 'react'
import { cn } from '@/common/utilities/cn'

export type StatPillProps = {
  icon?: ReactNode
  value: number | string
  label: string
  tone?: 'default' | 'streak' | 'success'
}

const toneClasses = {
  default: 'bg-muted text-muted-foreground',
  streak: 'bg-streak/15 text-streak-foreground',
  success: 'bg-success/15 text-success',
} as const

export function StatPill({
  icon,
  value,
  label,
  tone = 'default',
}: StatPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
        toneClasses[tone],
      )}
    >
      {icon}
      <span className="font-heading text-base font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}
