'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function AccountingBasisToggle({
  basis,
}: {
  basis: 'cash' | 'accrual';
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const updateBasis = (value: 'cash' | 'accrual') => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('basis', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Accounting basis</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="basis"
            value="cash"
            checked={basis === 'cash'}
            onChange={() => updateBasis('cash')}
          />
          Cash
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="basis"
            value="accrual"
            checked={basis === 'accrual'}
            onChange={() => updateBasis('accrual')}
          />
          Accrual
        </label>
      </div>
    </div>
  );
}
