import InfoCard from '@/components/layout/InfoCard'
import DataTable from '@/components/layout/DataTable'
import { PropertyService } from '@/lib/property-service'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bed, Bath, Building2 } from 'lucide-react'

export default async function UnitsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const property = await PropertyService.getPropertyById(id)

  if (!property || !Array.isArray(property.units) || property.units.length === 0) {
    return (
      <div id="panel-units" role="tabpanel" aria-labelledby="units">
        <InfoCard title="Units">
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No units found</h3>
            <p className="text-muted-foreground">Add units to this property to start managing rentals and leases.</p>
          </div>
        </InfoCard>
      </div>
    )
  }

  return (
    <div id="panel-units" role="tabpanel" aria-labelledby="units">
      <InfoCard title="Units">
        <DataTable
          head={
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Layout</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Market Rent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          }
        >
          {property.units.map((unit: any) => (
            <tr key={unit.id} className="hover:bg-muted/50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-foreground">{unit.unit_number || '-'}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-foreground">{unit.address_line1 || '-'}</div>
                <div className="text-sm text-muted-foreground">{[unit.city, unit.state].filter(Boolean).join(', ')}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center text-sm text-foreground">
                  <Bed className="h-4 w-4 mr-1" />
                  {unit.unit_bedrooms ?? '-'} bed
                  <Bath className="h-4 w-4 ml-2 mr-1" />
                  {unit.unit_bathrooms ?? '-'} bath
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{unit.unit_size ?? '-'} sq ft</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{unit.market_rent != null ? `$${Number(unit.market_rent).toLocaleString()}` : '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                {unit.status ? (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${unit.status === 'Occupied' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {unit.status}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <Link href={`/units/${unit.id}`}>
                  <Button variant="outline" size="sm">View</Button>
                </Link>
              </td>
            </tr>
          ))}
        </DataTable>
      </InfoCard>
    </div>
  )
}
