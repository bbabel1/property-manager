import { Suspense } from 'react';
import ChargesAnalyticsContent from './view';

export const dynamic = 'force-dynamic';

export default function ChargesAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <ChargesAnalyticsContent />
    </Suspense>
  );
}
