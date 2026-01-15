'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/components/ui/utils';
import { Body } from '@/ui/typography';

type BillsTabSwitcherProps = {
  initialTab: 'unpaid' | 'paid';
  paidDefaults: string[];
  unpaidContent: ReactNode;
  paidContent: ReactNode;
  className?: string;
};

export default function BillsTabSwitcher({
  initialTab,
  paidDefaults,
  unpaidContent,
  paidContent,
  className,
}: BillsTabSwitcherProps) {
  const [value, setValue] = useState<'unpaid' | 'paid'>(initialTab);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setValue(initialTab);
  }, [initialTab]);

  function handleChange(nextValue: string) {
    if (nextValue !== 'unpaid' && nextValue !== 'paid') return;
    if (nextValue === value) return;

    setValue(nextValue);

    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', nextValue);

    if (nextValue === 'paid') {
      if (paidDefaults.length) params.set('bstatus', paidDefaults.join(','));
      else params.delete('bstatus');
    } else {
      params.delete('bstatus');
    }

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="border-border border-b">
        <nav className="flex space-x-8" aria-label="Bills sections" role="navigation">
          <button
            onClick={() => handleChange('unpaid')}
            aria-current={value === 'unpaid' ? 'page' : undefined}
            className={`border-b-2 px-1 py-4 transition-colors ${
              value === 'unpaid'
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground hover:border-muted-foreground border-transparent'
            }`}
          >
            <Body as="span" size="sm" className="font-medium leading-tight">
              Unpaid bills
            </Body>
          </button>
          <button
            onClick={() => handleChange('paid')}
            aria-current={value === 'paid' ? 'page' : undefined}
            className={`border-b-2 px-1 py-4 transition-colors ${
              value === 'paid'
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground hover:border-muted-foreground border-transparent'
            }`}
          >
            <Body as="span" size="sm" className="font-medium leading-tight">
              Paid bills
            </Body>
          </button>
        </nav>
      </div>
      <div>
        {value === 'unpaid' && unpaidContent}
        {value === 'paid' && paidContent}
      </div>
    </div>
  );
}
