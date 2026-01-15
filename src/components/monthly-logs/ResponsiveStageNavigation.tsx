'use client';

import { useCallback, useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  FileText,
  PiggyBank,
  Percent,
  TrendingUp,
  FileCheck,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ProgressBar from '@/components/ui/progress-bar';
import type { MonthlyLogStage, MonthlyLogStatus } from './types';
import { Body, Label } from '@/ui/typography';

interface ResponsiveStageNavigationProps {
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
    description: 'Track tenant charges and fees',
  },
  payments: {
    label: 'Payments',
    icon: DollarSign,
    description: 'Record tenant payments received',
  },
  bills: {
    label: 'Bills',
    icon: FileText,
    description: 'Manage property expenses and bills',
  },
  escrow: {
    label: 'Escrow',
    icon: PiggyBank,
    description: 'Handle escrow deposits and reserves',
  },
  management_fees: {
    label: 'Management Fees',
    icon: Percent,
    description: 'Calculate management fees and commissions',
  },
  owner_distributions: {
    label: 'Owner Distributions',
    icon: TrendingUp,
    description: 'Process owner distributions and draws',
  },
  owner_statements: {
    label: 'Owner Statements',
    description: 'Generate and manage owner statements',
    icon: FileCheck,
  },
};

export default function ResponsiveStageNavigation({
  stages,
  activeStage,
  currentStage,
  onStageChange,
  status,
}: ResponsiveStageNavigationProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Simple mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleStageClick = useCallback(
    (stage: MonthlyLogStage) => {
      onStageChange(stage);
      setIsOpen(false);
    },
    [onStageChange],
  );

  const currentStageIndex = stages.indexOf(currentStage);
  const completedStages = status === 'complete' ? stages.length : currentStageIndex;
  const progressPercentage = Math.round((completedStages / stages.length) * 100);

  const activeConfig = STAGE_CONFIG[activeStage];

  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between">
          <Body as="div" size="sm">
            Progress: {completedStages} of {stages.length} stages
          </Body>
          <Body as="div" size="sm" tone="muted">
            {progressPercentage}%
          </Body>
        </div>
        <ProgressBar percentage={progressPercentage} />

        {/* Mobile Dropdown */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between gap-2"
              aria-label="Select stage"
            >
              <div className="flex items-center gap-2">
                {activeConfig && <activeConfig.icon className="h-4 w-4" />}
                <span>{activeConfig?.label || 'Select Stage'}</span>
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full min-w-[200px]" align="start">
            {stages.map((stage, index) => {
              const config = STAGE_CONFIG[stage];
              if (!config) return null;

              const Icon = config.icon;
              const isActive = activeStage === stage;
              const isCompleted =
                currentStageIndex > index || (status === 'complete' && currentStageIndex === index);
              const isCurrent = currentStage === stage;

              return (
                <DropdownMenuItem
                  key={stage}
                  onClick={() => handleStageClick(stage)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2',
                    isActive && 'bg-blue-50 text-blue-700',
                    isCompleted && !isActive && 'text-green-600',
                    isCurrent && !isActive && 'text-blue-600',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label as="span">{config.label}</Label>
                      {isCompleted && <Check className="h-3.5 w-3.5 text-primary-600" />}
                    </div>
                    <Body as="div" size="xs" tone="muted">
                      {config.description}
                    </Body>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Desktop Navigation
  return (
    <div className="space-y-4">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        <Body as="div" size="sm">
          Progress: {completedStages} of {stages.length} stages complete
        </Body>
        <Body as="div" size="sm" tone="muted">
          {progressPercentage}%
        </Body>
      </div>
      <ProgressBar percentage={progressPercentage} />

      {/* Desktop Stage Navigation */}
      <div className="flex flex-wrap items-center gap-1">
        {stages.map((stage, index) => {
          const config = STAGE_CONFIG[stage];
          if (!config) return null;

          const Icon = config.icon;
          const isActive = activeStage === stage;
          const isCompleted =
            currentStageIndex > index || (status === 'complete' && currentStageIndex === index);
          const isCurrent = currentStage === stage;

          return (
            <Button
              key={stage}
              variant="ghost"
              size="sm"
              onClick={() => handleStageClick(stage)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 transition-colors',
                isActive
                  ? 'border border-blue-200 bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                isCompleted && !isActive && 'text-green-600',
                isCurrent && !isActive && 'text-blue-600',
              )}
              title={config.description}
            >
              <Icon className="h-4 w-4" />
              <span className="flex items-center gap-1">
                {config.label}
                {isCompleted && <Check className="h-3.5 w-3.5 text-primary-600" />}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
