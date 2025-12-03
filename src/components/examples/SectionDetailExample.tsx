'use client';

import React from 'react'
import { SectionDetail, ContactInfoSection } from '@/components/ui/section-detail'

// Example usage of the new SectionDetail component
export function SectionDetailExample() {
  const handleEdit = () => {
    console.log('Edit clicked')
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Section Detail Component Examples</h1>
      
      {/* Example 1: Contact Information (using the convenience component) */}
      <ContactInfoSection
        email="dang@gmail.com"
        phone="9148347721"
        address={{
          line1: "99 John Street",
          city: "New York",
          state: "NY",
          postal: "10038"
        }}
        onEdit={handleEdit}
      />

      {/* Example 2: Custom fields with different layout */}
      <SectionDetail
        title="Property Details"
        fields={[
          { label: 'PROPERTY TYPE', value: 'Condo' },
          { label: 'STATUS', value: 'Active' },
          { label: 'YEAR BUILT', value: '2020' }
        ]}
        onEdit={handleEdit}
      />

      {/* Example 3: Two-column layout */}
      <SectionDetail
        title="Financial Summary"
        fields={[
          { label: 'CASH BALANCE', value: '$5.00' },
          { label: 'AVAILABLE BALANCE', value: '$-95.00' }
        ]}
        columns={2}
        onEdit={handleEdit}
      />

      {/* Example 4: Four-column layout */}
      <SectionDetail
        title="Unit Information"
        fields={[
          { label: 'UNIT', value: '5A' },
          { label: 'STATUS', value: 'Occupied' },
          { label: 'RENT', value: '$2,500' },
          { label: 'SQUARE FT', value: '1,200' }
        ]}
        columns={4}
        onEdit={handleEdit}
      />

      {/* Example 5: Compact variant */}
      <SectionDetail
        title="Quick Info"
        fields={[
          { label: 'ID', value: '8037' },
          { label: 'MANAGER', value: 'Brandon Michael' },
          { label: 'SERVICE', value: 'Full Service' }
        ]}
        variant="compact"
        onEdit={handleEdit}
      />

      {/* Example 6: Spacious variant */}
      <SectionDetail
        title="Detailed Information"
        fields={[
          { label: 'CREATED', value: 'January 15, 2024' },
          { label: 'LAST UPDATED', value: 'October 10, 2025' },
          { label: 'SYNC STATUS', value: 'Up to date' }
        ]}
        variant="spacious"
        onEdit={handleEdit}
      />

      {/* Example 7: Custom content */}
      <SectionDetail
        title="Custom Content"
        onEdit={handleEdit}
      >
        <div className="text-center py-4">
          <p className="text-muted-foreground">This section uses custom children instead of fields.</p>
          <p className="text-sm mt-2">You can put any React content here.</p>
        </div>
      </SectionDetail>
    </div>
  )
}




















