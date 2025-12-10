'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, DollarSign, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/transactions/formatting';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CollapsibleSummaryStatsProps {
  totalEnabled: number;
  totalMonthlyCost: number;
  servicePlan: string | null;
  serviceAssignment?: string | null;
}

export default function CollapsibleSummaryStats({
  totalEnabled,
  totalMonthlyCost,
  servicePlan,
  serviceAssignment,
}: CollapsibleSummaryStatsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardContent className="pt-6 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 rounded-full p-2">
                  <Settings className="text-primary h-4 w-4" />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Services Summary</p>
                  <p className="text-lg font-semibold">
                    {totalEnabled} enabled • {totalMonthlyCost > 0 ? formatCurrency(totalMonthlyCost) : '$0'}/mo
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Services Enabled</p>
                <p className="text-2xl font-bold">{totalEnabled}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Monthly Estimate</p>
                <p className="text-2xl font-bold">
                  {totalMonthlyCost > 0 ? formatCurrency(totalMonthlyCost) : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Service Plan</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">
                    {servicePlan || 'Not Set'}
                  </Badge>
                  {serviceAssignment && (
                    <Badge variant="outline" className="text-xs">
                      {serviceAssignment === 'Property Level' ? 'Property' : 'Unit'}-Level
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

