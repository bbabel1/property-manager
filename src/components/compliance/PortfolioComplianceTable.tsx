'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, CheckCircle, Clock, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CompliancePropertySummary } from '@/types/compliance';

interface PortfolioComplianceTableProps {
  properties: CompliancePropertySummary[];
  onSyncProperty?: (propertyId: string) => void;
  onCreateWorkOrder?: (propertyId: string) => void;
}

export function PortfolioComplianceTable({
  properties,
  onSyncProperty,
  onCreateWorkOrder,
}: PortfolioComplianceTableProps) {
  const getStatusIndicator = (status: 'critical' | 'warning' | 'ok') => {
    switch (status) {
      case 'critical':
        return <AlertCircle className="text-destructive h-4 w-4" />;
      case 'warning':
        return <Clock className="text-warning h-4 w-4" />;
      case 'ok':
        return <CheckCircle className="text-success h-4 w-4" />;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Property</TableHead>
            <TableHead>Borough</TableHead>
            <TableHead className="text-right">Assets</TableHead>
            <TableHead className="w-[100px] text-right text-sm">Open Violations</TableHead>
            <TableHead className="text-right">Overdue</TableHead>
            <TableHead className="text-right">Due Next 30 Days</TableHead>
            <TableHead>Last Elevator Inspection</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                No properties found
              </TableCell>
            </TableRow>
          ) : (
            properties.map((property) => (
              <TableRow key={property.property_id}>
                <TableCell>
                  <Link
                    href={`/properties/${property.property_id}/compliance`}
                    className="font-medium hover:underline"
                  >
                    {property.property_name}
                  </Link>
                  <div className="text-muted-foreground text-sm">{property.address_line1}</div>
                </TableCell>
                <TableCell>{property.borough || '—'}</TableCell>
                <TableCell className="text-right">{property.asset_count}</TableCell>
                <TableCell className="text-right">
                  {property.open_violations > 0 ? (
                    <Badge variant="destructive">{property.open_violations}</Badge>
                  ) : (
                    '0'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {property.overdue_items > 0 ? (
                    <Badge variant="destructive">{property.overdue_items}</Badge>
                  ) : (
                    '0'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {property.items_due_next_30_days > 0 ? (
                    <Badge variant="outline" className="border-warning text-warning">
                      {property.items_due_next_30_days}
                    </Badge>
                  ) : (
                    '0'
                  )}
                </TableCell>
                <TableCell>{formatDate(property.last_elevator_inspection)}</TableCell>
                <TableCell className="text-center">
                  {getStatusIndicator(property.status_indicator)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/properties/${property.property_id}/compliance`}>
                          View Compliance
                        </Link>
                      </DropdownMenuItem>
                      {onSyncProperty && (
                        <DropdownMenuItem onClick={() => onSyncProperty(property.property_id)}>
                          Sync Now
                        </DropdownMenuItem>
                      )}
                      {onCreateWorkOrder && (
                        <DropdownMenuItem onClick={() => onCreateWorkOrder(property.property_id)}>
                          Create Work Order
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
