'use client'

import type { ReactNode } from 'react'
import Providers from './providers'

type ClientProvidersProps = {
  children: ReactNode
}

function ClientProviders({ children }: ClientProvidersProps) {
  return <Providers>{children}</Providers>
}

export default ClientProviders
