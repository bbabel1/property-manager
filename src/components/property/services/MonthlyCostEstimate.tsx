'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/transactions/formatting';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { MonthlyCostEstimate as CostEstimate } from '@/lib/services/cost-calculator';
import { cn } from '@/components/ui/utils';

interface MonthlyCostEstimateProps {
  estimate: CostEstimate;
  className?: string;
}

export default function MonthlyCostEstimate({ estimate, className }: MonthlyCostEstimateProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (estimate.total === 0 && estimate.breakdown.length === 0) {
    return null;
  }

  return (
    <Card className={cn('sticky top-4 z-10', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary h-4 w-4" />
            <CardTitle className="text-base">Monthly Estimate</CardTitle>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-sm">Total</span>
            <span className="text-2xl font-bold">{formatCurrency(estimate.total)}</span>
          </div>

          {isExpanded && estimate.breakdown.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                By Category
              </div>
              {estimate.breakdown.map((category) => (
                <div key={category.category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{category.category}</span>
                    <Badge variant="outline" className="text-xs">
                      {category.services.length}
                    </Badge>
                  </div>
                  <span className="font-medium">{formatCurrency(category.monthlyCost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

