'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import Providers from './providers';

type ClientProvidersProps = {
  children: ReactNode;
};

const swrFetcher = async (resource: RequestInfo, init?: RequestInit) => {
  const response = await fetch(resource, init);
  if (!response.ok) {
    const info = await response.json().catch(() => null);
    const error = new Error(
      (info as { error?: string } | null)?.error ?? `Request failed with ${response.status}`,
    );
    (error as any).info = info;
    (error as any).status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
};

function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        provider: () => new Map(),
        revalidateOnFocus: false,
        dedupingInterval: 750,
        keepPreviousData: true,
      }}
    >
      <Providers>{children}</Providers>
    </SWRConfig>
  );
}

export default ClientProviders;
