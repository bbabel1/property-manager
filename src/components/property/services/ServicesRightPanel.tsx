'use client';

import { ReactNode, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface ServicesRightPanelProps {
  children: ReactNode;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  hasSelection: boolean;
}

export default function ServicesRightPanel({
  children,
  isMobile,
  isOpen,
  onClose,
  hasSelection,
}: ServicesRightPanelProps) {
  // Note: Opening/closing is handled by parent component

  // Mobile: Use drawer
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] overflow-y-auto">
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop/Tablet: Regular panel - always visible
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex-1">{children}</div>
    </div>
  );
}

