'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/components/ui/utils';

type BalanceBreakdownControlsProps = {
  asOf: string;
  view: 'property' | 'owner';
  selectedPropertyId: string | null;
  properties: Array<{ id: string; label: string }>;
};

export default function BalanceBreakdownControls({
  asOf,
  view,
  selectedPropertyId,
  properties,
}: BalanceBreakdownControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateSearch = (updates: {
    view?: 'property' | 'owner';
    propertyId?: string | null;
    asOf?: string | null;
  }) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', 'balance-breakdown');

    if (updates.view) {
      params.set('balanceView', updates.view);
    }

    if (updates.propertyId !== undefined) {
      if (updates.propertyId) params.set('balancePropertyId', updates.propertyId);
      else params.delete('balancePropertyId');
    }

    if (updates.asOf !== undefined) {
      if (updates.asOf) params.set('balanceAsOf', updates.asOf);
      else params.delete('balanceAsOf');
    }

    const next = params.toString();
    startTransition(() => {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  };

  const activeButtonClasses =
    'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';
  const inactiveButtonClasses = 'bg-background text-foreground';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'rounded-md px-4 py-2 text-sm font-semibold shadow-none',
            view === 'property' ? activeButtonClasses : inactiveButtonClasses,
          )}
          onClick={() => updateSearch({ view: 'property' })}
          disabled={isPending}
        >
          By property or company
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'rounded-md px-4 py-2 text-sm font-semibold shadow-none',
            view === 'owner' ? activeButtonClasses : inactiveButtonClasses,
          )}
          onClick={() => updateSearch({ view: 'owner' })}
          disabled={isPending}
        >
          By owner
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px]">
            <Select
              value={selectedPropertyId ?? 'all'}
              onValueChange={(value) => updateSearch({ propertyId: value === 'all' ? null : value })}
              disabled={!properties.length || isPending}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id} className="max-w-[420px] truncate">
                    {property.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">As of</span>
            <div className="w-[150px]">
              <DatePicker value={asOf} onChange={(value) => updateSearch({ asOf: value })} />
            </div>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          disabled={isPending}
        >
          <Download className="mr-2 h-4 w-4" aria-hidden /> Export
        </Button>
      </div>
    </div>
  );
}
