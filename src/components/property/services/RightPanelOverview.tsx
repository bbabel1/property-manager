'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Search, Filter } from 'lucide-react';

interface RightPanelOverviewProps {
  totalServices: number;
  enabledCount: number;
  onStartEditing?: () => void;
}

export default function RightPanelOverview({
  totalServices,
  enabledCount,
  onStartEditing,
}: RightPanelOverviewProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Settings className="text-primary h-8 w-8" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Service Configuration</h3>
          <p className="text-muted-foreground mb-6 text-sm">
            {enabledCount > 0
              ? `You have ${enabledCount} of ${totalServices} services enabled. Select a service to view details and configure pricing.`
              : `Browse ${totalServices} available services. Select a service to get started.`}
          </p>
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
              <Search className="h-3 w-3" />
              <span>Use search and filters to find services</span>
            </div>
            {onStartEditing && (
              <Button onClick={onStartEditing} className="mt-2">
                Start Editing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

