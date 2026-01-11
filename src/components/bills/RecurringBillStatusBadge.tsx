'use client'

import { Badge } from '@/components/ui/badge'
import { mapFrequencyToDisplayLabel, type RecurringBillSchedule } from '@/types/recurring-bills'
import { Repeat, Pause, X } from 'lucide-react'

export interface RecurringBillStatusBadgeProps {
  schedule: RecurringBillSchedule | null
  nextRunDate?: string | null
}

export function RecurringBillStatusBadge({
  schedule,
  nextRunDate,
}: RecurringBillStatusBadgeProps) {
  if (!schedule) {
    return null
  }

  const status = schedule.status || 'active'
  const frequency = schedule.frequency
  const displayLabel = mapFrequencyToDisplayLabel(frequency)

  const statusConfig = {
    active: {
      variant: 'default' as const,
      icon: Repeat,
      label: 'Active',
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    paused: {
      variant: 'secondary' as const,
      icon: Pause,
      label: 'Paused',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    ended: {
      variant: 'outline' as const,
      icon: X,
      label: 'Ended',
      className: 'bg-gray-100 text-gray-800 border-gray-200',
    },
  }

  const config = statusConfig[status] || statusConfig.active
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1.5 ${config.className}`}>
      <Icon className="h-3 w-3" />
      <span className="font-medium">{config.label}</span>
      <span className="text-xs opacity-75">• {displayLabel}</span>
      {nextRunDate && status === 'active' && (
        <span className="text-xs opacity-75">• Next: {nextRunDate}</span>
      )}
    </Badge>
  )
}

