'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Body, Heading } from '@/ui/typography';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { ComplianceProgram, ComplianceProgramWithPropertyContext } from '@/types/compliance';

type AvailableProgram = ComplianceProgram & {
  suppressed?: boolean;
  matches_criteria?: boolean;
  effective_is_enabled?: boolean;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || 'Failed to load programs');
  }
  return res.json();
};

type PropertyProgramsManagerProps = {
  propertyId: string;
  propertyName?: string;
  initialPrograms?: ComplianceProgramWithPropertyContext[];
  onChange?: () => void;
};

export function PropertyProgramsManager({
  propertyId,
  propertyName,
  initialPrograms = [],
  onChange,
}: PropertyProgramsManagerProps) {
  const [assignedPrograms, setAssignedPrograms] = useState<ComplianceProgramWithPropertyContext[]>(
    initialPrograms || [],
  );
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const [addWarningProgram, setAddWarningProgram] = useState<AvailableProgram | null>(null);

  useEffect(() => {
    setAssignedPrograms(initialPrograms || []);
  }, [initialPrograms]);

  const {
    data: availableData,
    isLoading: loadingAvailable,
    error: availableError,
    mutate: refreshAvailable,
  } = useSWR(
    propertyId ? `/api/compliance/properties/${propertyId}/programs/available` : null,
    fetcher,
  );

  const assignedIds = useMemo(
    () => new Set((assignedPrograms || []).map((program) => program.id)),
    [assignedPrograms],
  );

  const availablePrograms = useMemo(() => {
    const raw = Array.isArray(availableData?.programs)
      ? (availableData.programs as AvailableProgram[])
      : [];
    const filtered = raw.filter(
      (program) =>
        !assignedIds.has(program.id) &&
        (!search ||
          program.name?.toLowerCase().includes(search.toLowerCase()) ||
          program.code?.toLowerCase().includes(search.toLowerCase())),
    );
    return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [availableData?.programs, assignedIds, search]);

  const sortedAssigned = useMemo(
    () =>
      [...(assignedPrograms || [])].sort((a, b) =>
        (a.name || a.code || '').localeCompare(b.name || b.code || ''),
      ),
    [assignedPrograms],
  );

  const upsertAssigned = (program: ComplianceProgramWithPropertyContext) => {
    setAssignedPrograms((prev) => {
      const others = (prev || []).filter((p) => p.id !== program.id);
      return [...others, program];
    });
  };

  const handleToggle = async (programId: string, nextEnabled: boolean) => {
    setPendingToggleId(programId);
    setError(null);
    try {
      const res = await fetch(
        `/api/compliance/properties/${propertyId}/programs/${programId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_enabled: nextEnabled }),
        },
      );

      if (!res.ok) {
        throw new Error('Failed to update program');
      }

      const payload = await res.json();
      upsertAssigned({
        ...(payload.program || {}),
        override: payload.override,
        effective_is_enabled: payload.effective_is_enabled,
        is_assigned: true,
        matches_criteria:
          typeof payload.matches_criteria === 'boolean'
            ? payload.matches_criteria
            : (assignedPrograms.find((p) => p.id === programId)?.matches_criteria ?? true),
        suppressed: false,
      } as ComplianceProgramWithPropertyContext);
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update program');
    } finally {
      setPendingToggleId(null);
    }
  };

  const handleRemove = async (programId: string) => {
    setPendingToggleId(programId);
    setError(null);
    try {
      const res = await fetch(
        `/api/compliance/properties/${propertyId}/programs/${programId}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok) {
        throw new Error('Failed to remove program');
      }
      setAssignedPrograms((prev) => (prev || []).filter((p) => p.id !== programId));
      await refreshAvailable();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove program');
    } finally {
      setPendingToggleId(null);
    }
  };

  const handleAdd = async (programId: string) => {
    setPendingAddId(programId);
    setError(null);
    try {
      const res = await fetch(`/api/compliance/properties/${propertyId}/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Failed to add program');
      }

      const payload = await res.json();
      upsertAssigned({
        ...(payload.program || {}),
        override: payload.override,
        matches_criteria: payload.matches_criteria,
        effective_is_enabled: payload.effective_is_enabled,
        is_assigned: true,
        suppressed: false,
      } as ComplianceProgramWithPropertyContext);
      await refreshAvailable();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add program');
    } finally {
      setPendingAddId(null);
    }
  };

  const requestAdd = (program: AvailableProgram) => {
    if (program.matches_criteria === false || program.suppressed) {
      setAddWarningProgram(program);
      return;
    }
    void handleAdd(program.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <Heading as="h3" size="h5">
          Manage programs for {propertyName || 'this property'}
        </Heading>
        <Body as="p" size="sm" tone="muted">
          Assign programs even when they don&apos;t match criteria, toggle them on/off, or remove them from this property.
        </Body>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <Heading as="h3" size="h6">
                Assigned programs
              </Heading>
            </CardTitle>
            <Badge variant="outline">{sortedAssigned.length}</Badge>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-3 p-4">
            {sortedAssigned.length === 0 && (
              <p className="text-muted-foreground text-sm">No programs assigned yet.</p>
            )}
            {sortedAssigned.map((program) => {
              const disabled = pendingToggleId === program.id;
              const isOn =
                typeof program.effective_is_enabled === 'boolean'
                  ? program.effective_is_enabled
                  : program.is_enabled;
              return (
                <div
                  key={program.id}
                  className="flex flex-col gap-2 rounded-md border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{program.name || program.code}</span>
                        <Badge variant="secondary">{program.code}</Badge>
                        {program.suppressed && <Badge variant="destructive">Removed</Badge>}
                        {program.matches_criteria === false && (
                          <Badge variant="outline">Doesn&apos;t match criteria</Badge>
                        )}
                        {!program.is_enabled && (
                          <Badge variant="outline">Globally disabled</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {program.jurisdiction || 'Program'} • {program.applies_to || 'property'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        disabled={disabled}
                        checked={!!isOn}
                        onCheckedChange={(checked) => handleToggle(program.id, checked)}
                        aria-label={`Toggle ${program.name || program.code}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        onClick={() => setPendingRemovalId(program.id)}
                      >
                        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>
                <Heading as="h3" size="h6">
                  Add programs
                </Heading>
              </CardTitle>
              <p className="text-muted-foreground text-xs">
                Programs not yet assigned to this property.
              </p>
            </div>
            <Badge variant="outline">{availablePrograms.length}</Badge>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-3 p-4">
            <Input
              placeholder="Search programs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {availableError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                {availableError instanceof Error
                  ? availableError.message
                  : 'Failed to load available programs.'}
              </div>
            )}
            {loadingAvailable && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading available programs...
              </div>
            )}
            {!loadingAvailable && availablePrograms.length === 0 && (
              <p className="text-muted-foreground text-sm">No additional programs available.</p>
            )}
            <div className="space-y-2">
                      {availablePrograms.map((program: AvailableProgram) => {
                        const disabled = pendingAddId === program.id;
                        return (
                          <div
                            key={program.id}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{program.name || program.code}</span>
                          <Badge variant="secondary">{program.code}</Badge>
                          {program.matches_criteria === false && (
                            <Badge variant="outline">Doesn&apos;t match criteria</Badge>
                          )}
                          {program.suppressed && (
                            <Badge variant="outline">Previously removed</Badge>
                          )}
                          {!program.is_enabled && (
                            <Badge variant="outline">Globally disabled</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {program.jurisdiction || 'Program'} • {program.applies_to || 'property'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={disabled}
                        onClick={() => requestAdd(program)}
                      >
                        {disabled ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(addWarningProgram)} onOpenChange={(open) => !open && setAddWarningProgram(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add program that doesn&apos;t match criteria?</AlertDialogTitle>
            <AlertDialogDescription>
            {addWarningProgram?.name || addWarningProgram?.code} doesn&apos;t match this property&apos;s criteria
            {addWarningProgram?.suppressed ? ' and was previously removed' : ''}. You can add it anyway to force generation for this property.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAddWarningProgram(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const programId = addWarningProgram?.id;
                setAddWarningProgram(null);
                if (programId) void handleAdd(programId);
              }}
            >
              Add anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingRemovalId)} onOpenChange={(open) => !open && setPendingRemovalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove program from this property?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing a program keeps existing items but stops future auto-generation. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRemovalId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = pendingRemovalId;
                setPendingRemovalId(null);
                if (id) void handleRemove(id);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
