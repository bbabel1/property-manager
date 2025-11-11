'use client';

import { useCallback } from 'react';
import {
  CreditCard,
  DollarSign,
  FileText,
  PiggyBank,
  Percent,
  TrendingUp,
  FileCheck,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import type { MonthlyLogStage, MonthlyLogStatus } from './types';

interface MonthlyLogStageNavigationProps {
  stages: MonthlyLogStage[];
  activeStage: MonthlyLogStage;
  currentStage: MonthlyLogStage;
  onStageChange: (stage: MonthlyLogStage) => void;
  status?: MonthlyLogStatus;
}

const STAGE_CONFIG = {
  charges: {
    label: 'Charges',
    icon: CreditCard,
  },
  payments: {
    label: 'Payments',
    icon: DollarSign,
  },
  bills: {
    label: 'Bills',
    icon: FileText,
  },
  escrow: {
    label: 'Escrow',
    icon: PiggyBank,
  },
  management_fees: {
    label: 'Management Fees',
    icon: Percent,
  },
  owner_distributions: {
    label: 'Owner Distributions',
    icon: TrendingUp,
  },
  owner_statements: {
    label: 'Owner Statements',
    icon: FileCheck,
  },
};

export default function MonthlyLogStageNavigation({
  stages,
  activeStage,
  currentStage,
  onStageChange,
  status,
}: MonthlyLogStageNavigationProps) {
  const handleStageClick = useCallback(
    (stage: MonthlyLogStage) => {
      onStageChange(stage);
    },
    [onStageChange],
  );

  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, index) => {
        const config = STAGE_CONFIG[stage];
        if (!config) {
          console.warn(`No configuration found for stage: ${stage}`);
          return null;
        }

        const Icon = config.icon;
        const isActive = activeStage === stage;
        const currentIndex = stages.indexOf(currentStage);
        const logComplete = status === 'complete';
        const isCompleted = currentIndex > index || (logComplete && currentIndex === index);
        const isCurrent = currentStage === stage;

        return (
          <Button
            key={stage}
            variant="ghost"
            size="sm"
            onClick={() => handleStageClick(stage)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border border-blue-200 bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              isCompleted && !isActive && 'text-green-600',
              isCurrent && !isActive && 'text-blue-600',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex items-center gap-1">
              {config.label}
              {isCompleted ? <Check className="h-3.5 w-3.5 text-[var(--color-action-600)]" /> : null}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
