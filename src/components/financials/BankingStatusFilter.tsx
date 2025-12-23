'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type BankingStatus = 'active' | 'inactive' | 'all';

type BankingStatusFilterProps = {
  initialStatus: BankingStatus;
};

const STATUS_OPTIONS: { value: BankingStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All statuses' },
];

export default function BankingStatusFilter({ initialStatus }: BankingStatusFilterProps) {
  const [status, setStatus] = useState<BankingStatus>(initialStatus);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const applyFilter = () => {
    const base = searchParams ? searchParams.toString() : '';
    const params = new URLSearchParams(base);

    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        <Select value={status} onValueChange={(value) => setStatus(value as BankingStatus)}>
          <SelectTrigger className="min-w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={applyFilter}
      >
        Apply filter
      </Button>
    </div>
  );
}

