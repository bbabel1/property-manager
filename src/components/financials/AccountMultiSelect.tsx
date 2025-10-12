"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/utils'

export type AccountOption = {
  value: string
  label: string
  group: string
  groupLabel?: string | null
}

export type AccountGroup = {
  id: string
  label: string
  count: number
}

interface AccountMultiSelectProps {
  value: string[]
  onChange: (ids: string[]) => void
  options: AccountOption[]
  placeholder?: string
  className?: string
  hideGroupSidebar?: boolean
  selectAllLabel?: string
  clearAllLabel?: string
}

export default function AccountMultiSelect({
  value,
  onChange,
  options,
  placeholder = 'All accounts',
  className,
  hideGroupSidebar = false,
  selectAllLabel = 'Select all accounts',
  clearAllLabel = 'Clear all accounts',
}: AccountMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string>('all')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selection = useMemo(() => new Set(value), [value])

  const groups = useMemo(() => {
    const map = new Map<string, AccountGroup & { options: AccountOption[] }>()
    for (const opt of options) {
      const id = opt.group || 'Other'
      const label = opt.groupLabel || (opt.group ? `${opt.group} accounts` : 'Other accounts')
      const existing = map.get(id)
      if (existing) {
        existing.count += 1
        existing.options.push(opt)
      } else {
        map.set(id, {
          id,
          label,
          count: 1,
          options: [opt],
        })
      }
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id))
    return {
      list: sorted,
      lookup: sorted.reduce<Record<string, AccountOption[]>>((acc, group) => {
        acc[group.id] = group.options
        return acc
      }, {}),
    }
  }, [options])

  const allOptions = options
  const hasGroupSidebar = !hideGroupSidebar && groups.list.length > 1
  const activeOptions = hasGroupSidebar && activeGroup !== 'all'
    ? groups.lookup[activeGroup] || []
    : allOptions
  const filteredOptions = activeOptions.filter((opt) =>
    opt.label.toLowerCase().includes(search.trim().toLowerCase())
  )

  const activeGroupLabel = useMemo(() => {
    if (activeGroup === 'all') return 'All accounts'
    const match = groups.list.find((g) => g.id === activeGroup)
    return match?.label || `${activeGroup} accounts`
  }, [activeGroup, groups.list])

  function toggleValue(val: string) {
    const next = new Set(selection)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(Array.from(next))
  }

  function selectAll() {
    if (selection.size === allOptions.length) {
      onChange([])
    } else {
      onChange(allOptions.map((opt) => opt.value))
    }
  }

  function toggleGroup(groupId: string) {
    const opts = groupId === 'all' ? allOptions : groups.lookup[groupId] || []
    const allSelected = opts.every((opt) => selection.has(opt.value))
    const next = new Set(selection)
    if (allSelected) {
      opts.forEach((opt) => next.delete(opt.value))
    } else {
      opts.forEach((opt) => next.add(opt.value))
    }
    onChange(Array.from(next))
  }

  const allSelected = value.length > 0 && value.length === options.length
  const buttonLabel = value.length === 0 || allSelected
    ? placeholder
    : `${value.length} selected`

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="border-input flex min-w-[16rem] items-center justify-between gap-2 rounded-md border bg-input-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="line-clamp-1 text-left text-foreground/80">
          {buttonLabel}
        </span>
        <ChevronDownIcon className="size-4 opacity-50" />
      </button>
      {open ? (
        <div
          className={cn(
            'absolute z-50 mt-2 overflow-hidden rounded-md border bg-popover shadow-xl',
            hasGroupSidebar ? 'w-[32rem]' : 'w-[22rem]'
          )}
        >
          <div className={cn(hasGroupSidebar ? 'flex' : '')}>
            {hasGroupSidebar ? (
              <div className="w-[11rem] border-r border-border bg-muted/40">
                <button
                  type="button"
                  onClick={() => setActiveGroup('all')}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted',
                    activeGroup === 'all' && 'bg-muted text-foreground font-medium'
                  )}
                >
                  <span>All ({allOptions.length})</span>
                </button>
                {groups.list.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveGroup(group.id)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted',
                      activeGroup === group.id && 'bg-muted text-foreground font-medium'
                    )}
                  >
                    <span>{group.label}</span>
                    <span className="text-xs text-muted-foreground">{group.count}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className={cn('p-3', hasGroupSidebar ? 'flex-1' : '')}>
              <div className="flex items-center gap-2 rounded-md border border-input bg-input-background px-2 py-1">
                <SearchIcon className="size-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search accounts"
                  className="flex-1 border-none bg-transparent text-sm outline-none"
                />
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start px-2 text-foreground"
                  onClick={selectAll}
                >
                  {selection.size === allOptions.length ? clearAllLabel : selectAllLabel}
                </Button>
                {activeGroup !== 'all' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start px-2 text-foreground"
                    onClick={() => toggleGroup(activeGroup)}
                  >
                    {groups.lookup[activeGroup]?.every((opt) => selection.has(opt.value))
                      ? `Clear ${activeGroupLabel.toLowerCase()}`
                      : `Select ${activeGroupLabel.toLowerCase()}`}
                  </Button>
                ) : null}
              </div>
              <div className="mt-3 max-h-72 overflow-y-auto pr-1">
                {filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No accounts found.</div>
                ) : (
                  filteredOptions.map((opt) => {
                    const active = selection.has(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleValue(opt.value)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted'
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-5 items-center justify-center rounded-sm border border-muted-foreground/40',
                            active && 'bg-primary text-primary-foreground'
                          )}
                        >
                          {active ? <CheckIcon className="size-3" /> : null}
                        </span>
                        <span className="text-sm">{opt.label}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
