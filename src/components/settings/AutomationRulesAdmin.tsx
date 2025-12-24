'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Zap } from 'lucide-react';

interface AutomationRule {
  id: string;
  offering_id: string;
  offering_name: string;
  rule_type: 'recurring_task' | 'recurring_charge' | 'workflow_trigger';
  frequency: string;
  task_template: string | null;
  charge_template: string | null;
  conditions: Record<string, unknown> | null;
  is_active: boolean;
}

export default function AutomationRulesAdmin() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [offerings, setOfferings] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [rulesResponse, offeringsResponse] = await Promise.all([
        fetch('/api/services/automation-rules'),
        fetch('/api/services/catalog'),
      ]);

      if (!rulesResponse.ok) {
        throw new Error('Failed to load automation rules');
      }

      const rulesData = (await rulesResponse.json()) as { data?: AutomationRule[] };
      const offeringsData = (await offeringsResponse.json()) as {
        data?: Array<{ id: string | number; name?: string | null }>;
      };

      setRules(rulesData.data || []);
      setOfferings(
        (offeringsData.data || []).map((o) => ({
          id: String(o.id),
          name: o.name ?? String(o.id),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (rule: Partial<AutomationRule>) => {
    try {
      const url = editingRule
        ? `/api/services/automation-rules/${editingRule.id}`
        : '/api/services/automation-rules';
      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });

      if (!response.ok) {
        throw new Error('Failed to save automation rule');
      }

      setIsDialogOpen(false);
      setEditingRule(null);
      loadData();
    } catch (err) {
      console.error('Error saving rule:', err);
      alert('Failed to save automation rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;

    try {
      const response = await fetch(`/api/services/automation-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete automation rule');
      }

      loadData();
    } catch (err) {
      console.error('Error deleting rule:', err);
      alert('Failed to delete automation rule');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center">
          Loading automation rules...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-destructive text-center">{error}</div>
          <div className="mt-4 text-center">
            <Button onClick={loadData} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Automation Rules</CardTitle>
              <CardDescription>
                Configure when and how service offerings generate tasks and charges
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingRule(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[680px] max-w-[680px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
                  </DialogTitle>
                </DialogHeader>
                <AutomationRuleForm
                  rule={editingRule}
                  offerings={offerings}
                  onSave={handleSaveRule}
                  onCancel={() => {
                    setIsDialogOpen(false);
                    setEditingRule(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
              No automation rules configured. Click "Add Rule" to create one.
            </div>
          ) : (
            <div className="border-border overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Rule Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.offering_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.rule_type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>{rule.frequency}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {rule.task_template || rule.charge_template || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingRule(rule);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AutomationRuleFormProps {
  rule: AutomationRule | null;
  offerings: Array<{ id: string; name: string }>;
  onSave: (rule: Partial<AutomationRule>) => Promise<void>;
  onCancel: () => void;
}

function AutomationRuleForm({ rule, offerings, onSave, onCancel }: AutomationRuleFormProps) {
  const [offeringId, setOfferingId] = useState(rule?.offering_id || '');
  const [ruleType, setRuleType] = useState<AutomationRule['rule_type']>(
    rule?.rule_type || 'recurring_task',
  );
  const [frequency, setFrequency] = useState(rule?.frequency || 'monthly');
  const [taskTemplate, setTaskTemplate] = useState(rule?.task_template || '');
  const [chargeTemplate, setChargeTemplate] = useState(rule?.charge_template || '');
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ruleType === 'recurring_task' && !taskTemplate.trim()) {
      alert('Task template is required for recurring tasks.');
      return;
    }
    if (ruleType === 'recurring_charge' && !chargeTemplate.trim()) {
      alert('Charge template is required for recurring charges.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        offering_id: offeringId,
        rule_type: ruleType,
        frequency,
        task_template: ruleType === 'recurring_task' ? taskTemplate : null,
        charge_template: ruleType === 'recurring_charge' ? chargeTemplate : null,
        is_active: isActive,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="offering">Service Offering</Label>
        <Select value={offeringId} onValueChange={setOfferingId} required>
          <SelectTrigger id="offering">
            <SelectValue placeholder="Select service offering" />
          </SelectTrigger>
          <SelectContent>
            {offerings.map((offering) => (
              <SelectItem key={offering.id} value={offering.id}>
                {offering.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rule-type">Rule Type</Label>
        <Select
          value={ruleType}
          onValueChange={(value) => setRuleType(value as AutomationRule['rule_type'])}
          required
        >
          <SelectTrigger id="rule-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recurring_task">Recurring Task</SelectItem>
            <SelectItem value="recurring_charge">Recurring Charge</SelectItem>
            <SelectItem value="workflow_trigger">Workflow Trigger</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="frequency">Frequency</Label>
        <Select value={frequency} onValueChange={setFrequency} required>
          <SelectTrigger id="frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annually">Annually</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="biweekly">Biweekly</SelectItem>
            <SelectItem value="on_event">On Event</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {ruleType === 'recurring_task' && (
        <div className="space-y-2">
          <Label htmlFor="task-template">Task Template</Label>
          <Input
            id="task-template"
            value={taskTemplate}
            onChange={(e) => setTaskTemplate(e.target.value)}
            placeholder="e.g., Review {service_name} for {property_name}"
          />
          <p className="text-muted-foreground text-xs">
            Use {'{service_name}'}, {'{property_name}'}, {'{unit_number}'} as placeholders
          </p>
        </div>
      )}

      {ruleType === 'recurring_charge' && (
        <div className="space-y-2">
          <Label htmlFor="charge-template">Charge Template</Label>
          <Input
            id="charge-template"
            value={chargeTemplate}
            onChange={(e) => setChargeTemplate(e.target.value)}
            placeholder="e.g., {service_name} Fee"
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="is-active">Active</Label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
        </Button>
      </div>
    </form>
  );
}
