'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'general-ledger-filters';
const FILTER_KEYS = ['from', 'to', 'range', 'properties', 'units', 'gl', 'basis'];

export default function LedgerFilterPersistence() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchParamsString = useMemo(() => searchParams?.toString() ?? '', [searchParams]);
  const hasAttemptedRestore = useRef(false);
  const pendingStoredParams = useRef<string | null>(null);

  // Restore saved filters on first render when no explicit params are present.
  useEffect(() => {
    if (hasAttemptedRestore.current) return;
    hasAttemptedRestore.current = true;
    if (typeof window === 'undefined') return;

    try {
      const storedRaw = window.localStorage.getItem(STORAGE_KEY);
      pendingStoredParams.current = storedRaw;
      if (!storedRaw) return;

      const storedParams = new URLSearchParams(storedRaw);
      const currentParams = new URLSearchParams(searchParamsString);
      let changed = false;

      FILTER_KEYS.forEach((key) => {
        const storedValue = storedParams.get(key);
        if (storedValue && !currentParams.get(key)) {
          currentParams.set(key, storedValue);
          changed = true;
        }
      });

      if (changed) {
        const query = currentParams.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }
    } catch (error) {
      console.error('Failed to restore general ledger filters from storage', error);
    }
  }, [pathname, router, searchParamsString]);

  // Persist relevant filters whenever the query string changes.
  useEffect(() => {
    if (!hasAttemptedRestore.current) return;
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(searchParamsString);
      const filtered = new URLSearchParams();
      FILTER_KEYS.forEach((key) => {
        const value = params.get(key);
        if (value) filtered.set(key, value);
      });

      const serialized = filtered.toString();
      if (serialized) {
        window.localStorage.setItem(STORAGE_KEY, serialized);
        pendingStoredParams.current = null;
      } else if (pendingStoredParams.current && searchParamsString === '') {
        // Wait for restored params to load before clearing the saved state.
        return;
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        pendingStoredParams.current = null;
      }
    } catch (error) {
      console.error('Failed to persist general ledger filters to storage', error);
    }
  }, [searchParamsString]);

  return null;
}
