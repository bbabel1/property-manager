'use client';

import React from 'react'
import { Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface SectionDetailField {
  label: string
  value: string | React.ReactNode
  className?: string
  span?: 1 | 2 | 3 // How many columns this field should span
}

export interface SectionDetailProps {
  title: string
  fields?: SectionDetailField[]
  onEdit?: () => void
  editing?: boolean
  editButtonAriaLabel?: string
  className?: string
  children?: React.ReactNode
  columns?: 1 | 2 | 3 | 4 // Number of columns in the grid
  variant?: 'default' | 'compact' | 'spacious' // Different spacing variants
}

export function SectionDetail({
  title,
  fields = [],
  onEdit,
  editing = false,
  editButtonAriaLabel = `Edit ${title.toLowerCase()}`,
  className = "",
  children,
  columns = 3,
  variant = 'default'
}: SectionDetailProps) {
  // Variant spacing configurations
  const variantConfig = {
    compact: {
      headerSpacing: 'mb-3 pb-2',
      cardPadding: 'p-4',
      fieldSpacing: 'gap-4',
      labelSpacing: 'mb-1'
    },
    default: {
      headerSpacing: 'mb-4 pb-3',
      cardPadding: 'p-6',
      fieldSpacing: 'gap-6',
      labelSpacing: 'mb-1'
    },
    spacious: {
      headerSpacing: 'mb-6 pb-4',
      cardPadding: 'p-8',
      fieldSpacing: 'gap-8',
      labelSpacing: 'mb-2'
    }
  }

  const config = variantConfig[variant]

  // Grid column classes
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  }

  return (
    <div className={className}>
      {/* Section Header */}
      <div className={`flex items-center gap-3 border-b border-border ${config.headerSpacing}`}>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {!editing && onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label={editButtonAriaLabel}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Section Content */}
      <Card className={editing ? 'relative overflow-hidden border-l-2 border-l-primary shadow-lg bg-white border border-border' : 'bg-white'}>
        <CardContent className={`relative ${config.cardPadding}`}>
          {editing && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
          
          {children || (
            <div className={`grid ${gridClasses[columns]} ${config.fieldSpacing} text-sm`}>
              {fields.map((field, index) => {
                const spanClass = field.span ? `col-span-${field.span}` : ''
                return (
                  <div key={index} className={`${spanClass} ${field.className || ''}`}>
                    <div className={`text-xs font-medium text-muted-foreground uppercase ${config.labelSpacing}`}>
                      {field.label}
                    </div>
                    <div className="text-foreground">
                      {field.value || '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Convenience component for contact information specifically
export interface ContactInfoProps {
  email?: string | null
  phone?: string | null
  address?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal?: string | null
  }
  onEdit?: () => void
  editing?: boolean
  className?: string
}

export function ContactInfoSection({
  email,
  phone,
  address,
  onEdit,
  editing = false,
  className = ""
}: ContactInfoProps) {
  const addressValue = address ? (
    <div className="space-y-0.5">
      <div>{address.line1 || '—'}</div>
      {address.line2 && <div>{address.line2}</div>}
      <div>
        {[
          address.city || '',
          address.state || '',
          address.postal || ''
        ].filter(Boolean).join(', ') || '—'}
      </div>
    </div>
  ) : '—'

  const fields: SectionDetailField[] = [
    {
      label: 'EMAIL',
      value: email || '—'
    },
    {
      label: 'PHONE',
      value: phone || '—'
    },
    {
      label: 'ADDRESS',
      value: addressValue
    }
  ]

  return (
    <SectionDetail
      title="Contact information"
      fields={fields}
      onEdit={onEdit}
      editing={editing}
      className={className}
    />
  )
}
