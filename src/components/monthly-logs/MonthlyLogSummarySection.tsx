'use client';

import { memo } from 'react';

import EnhancedFinancialSummaryCard from '@/components/monthly-logs/EnhancedFinancialSummaryCard';
import type { MonthlyLogFinancialSummary } from '@/types/monthly-log';

interface MonthlyLogSummarySectionProps {
  summary: MonthlyLogFinancialSummary | null;
  loading: boolean;
}

function MonthlyLogSummarySectionComponent({
  summary,
  loading,
}: MonthlyLogSummarySectionProps) {
  return (
    <div className="space-y-6">
      <EnhancedFinancialSummaryCard summary={summary} loading={loading} />
    </div>
  );
}

const MonthlyLogSummarySection = memo(MonthlyLogSummarySectionComponent);

export default MonthlyLogSummarySection;
