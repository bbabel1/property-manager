'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ManagementServiceCard from './ManagementServiceCard';
import ManagementServiceUnitList from './ManagementServiceUnitList';

export type AssignmentLevel = 'Property Level' | 'Unit Level';

export default function PropertyServicesPageContent({
  propertyId,
  initialServiceAssignment,
}: {
  propertyId: string;
  initialServiceAssignment?: AssignmentLevel | null;
}) {
  const [serviceAssignment, setServiceAssignment] = useState<AssignmentLevel | null>(
    initialServiceAssignment ?? null,
  );
  const [assignmentChangeDialogOpen, setAssignmentChangeDialogOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<AssignmentLevel | null>(null);
  const [changingAssignment, setChangingAssignment] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const current = serviceAssignment ?? 'Property Level';

  const requestChange = (next: AssignmentLevel) => {
    if (next === current) return;
    setPendingAssignment(next);
    setAssignmentChangeDialogOpen(true);
  };

  const confirmChange = async () => {
    if (!pendingAssignment) return;
    try {
      setChangingAssignment(true);
      const res = await fetch('/api/services/assignment-level', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          service_assignment: pendingAssignment,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Failed to update assignment level');
      }
      setServiceAssignment(pendingAssignment);
      setRefreshKey((k) => k + 1);
      toast.success('Assignment level updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update assignment level';
      toast.error(message);
    } finally {
      setChangingAssignment(false);
      setAssignmentChangeDialogOpen(false);
      setPendingAssignment(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Assignment Level</CardTitle>
                <CardDescription className="hidden text-xs sm:block">
                  Changing this clears existing plan assignments and selected services.
                </CardDescription>
              </div>
              <CardDescription className="text-xs sm:hidden">
                Changing this clears existing plan assignments and selected services.
              </CardDescription>
            </div>
            <Select value={current} onValueChange={(v) => requestChange(v as AssignmentLevel)}>
              <SelectTrigger className="w-full sm:w-[220px]" aria-label="Assignment level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Property Level">Property Level</SelectItem>
                <SelectItem value="Unit Level">Unit Level</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {current === 'Unit Level' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Property Services</CardTitle>
              <CardDescription>
                This property is set to Unit Level assignments. Configure services on each unit’s Services tab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Assigning a plan at the property level is disabled while Unit Level is selected.
              </p>
            </CardContent>
          </Card>
          <ManagementServiceUnitList key={refreshKey} propertyId={propertyId} />
        </div>
      ) : (
        <ManagementServiceCard
          key={refreshKey}
          propertyId={propertyId}
          title="Property Services"
          subtitle="Select a plan, pick services (for A-la-carte), and set billing details."
        />
      )}

      <Dialog open={assignmentChangeDialogOpen} onOpenChange={setAssignmentChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change assignment level?</DialogTitle>
            <DialogDescription>
              Changing the assignment level clears existing configured plan assignments and selected services for this property (including any unit-level configurations).
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignmentChangeDialogOpen(false)}
              disabled={changingAssignment}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmChange} disabled={changingAssignment}>
              {changingAssignment ? 'Updating…' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
