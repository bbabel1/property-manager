import { Suspense } from 'react';
import LeasesAnalyticsContent from './view';

export const dynamic = 'force-dynamic';

export default function LeasesAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <LeasesAnalyticsContent />
    </Suspense>
  );
}
