import type { Metadata } from 'next';
import type { NextWebVitalsMetric } from 'next/app';
import React from 'react';
import localFont from 'next/font/local';
import './globals.css';
import ClientProviders from '@/components/client-providers';
import Script from 'next/script';

const sourceSans = localFont({
  src: [
    {
      path: '../../public/fonts/source-sans-3/SourceSans3Latin-400-700.woff2',
      weight: '400 700',
      style: 'normal',
    },
  ],
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'Ora Property Management',
  description: 'Modern property management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={sourceSans.className}>
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
          <Script
            id="google-maps-places"
            src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
            strategy="afterInteractive"
          />
        ) : null}
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    id: metric.id,
    name: metric.name,
    label: metric.label,
    value: metric.value,
    path: window.location.pathname,
    ts: Date.now(),
  });
  const url = '/api/metrics/rum';

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body);
    return;
  }

  fetch(url, {
    body,
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
  }).catch(() => {
    // No-op: telemetry should never throw
  });
}
