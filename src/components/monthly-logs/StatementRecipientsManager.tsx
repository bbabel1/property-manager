/**
 * Statement Recipients Manager Component
 *
 * Allows users to configure email recipients for monthly statement delivery.
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  getStatementRecipients,
  isValidRecipientEmail,
  updateStatementRecipients,
  type StatementRecipient,
} from '@/modules/monthly-logs/services/statement-recipients';

interface StatementRecipientsManagerProps {
  propertyId: string;
  onRecipientsChange?: (recipients: StatementRecipient[]) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export default function StatementRecipientsManager({
  propertyId,
  onRecipientsChange,
  onLoadingChange,
}: StatementRecipientsManagerProps) {
  const [recipients, setRecipients] = useState<StatementRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);

  // New recipient form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Owner');

  useEffect(() => {
    fetchRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  const pushRecipientsChange = (nextRecipients: StatementRecipient[]) => {
    setRecipients(nextRecipients);
    onRecipientsChange?.(nextRecipients);
  };

  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const nextRecipients = await getStatementRecipients(propertyId);
      setRecipients(nextRecipients);
      onRecipientsChange?.(nextRecipients);
    } catch (error) {
      console.warn('Error fetching recipients:', error);
      toast.error('Failed to load recipients');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await updateStatementRecipients(propertyId, recipients);
      toast.success('Recipients updated successfully');
      setEditing(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save recipients';
      console.warn('Error saving recipients:', error);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecipient = () => {
    if (!newEmail || !newName) {
      toast.error('Email and name are required');
      return;
    }

    if (!isValidRecipientEmail(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check for duplicates
    if (recipients.some((r) => r.email.toLowerCase() === newEmail.toLowerCase())) {
      toast.error('This email is already in the recipient list');
      return;
    }

    const nextRecipients = [...recipients, { email: newEmail, name: newName, role: newRole }];
    pushRecipientsChange(nextRecipients);
    setNewEmail('');
    setNewName('');
    setNewRole('Owner');
    setEditing(true);
  };

  const handleRemoveRecipient = (email: string) => {
    const nextRecipients = recipients.filter((r) => r.email !== email);
    pushRecipientsChange(nextRecipients);
    setEditing(true);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-11 rounded-md bg-slate-200/70"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {editing && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      )}

      {/* Existing Recipients */}
      {recipients.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-100">
          {recipients.map((recipient, index) => (
            <div
              key={recipient.email}
              className={`flex items-center justify-between gap-3 px-3 py-2 ${index < recipients.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">{recipient.name}</div>
                <div className="text-xs text-slate-600">{recipient.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
                  {recipient.role}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRecipient(recipient.email)}
                  className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <AlertCircle className="h-4 w-4 text-slate-400" />
          <span>No recipients added yet.</span>
        </div>
      )}

      {/* Add New Recipient Form */}
      {showAddRow ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
              <Input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="h-9 text-sm"
              />
              <Input
                type="text"
                placeholder="Full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 text-sm"
              />
              <Input
                type="text"
                placeholder="Role (e.g., Owner)"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Button onClick={handleAddRecipient} size="sm" className="h-9 w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add recipient
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-default items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-slate-400" />
                  <span className="underline decoration-dotted underline-offset-2">What gets sent</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p>Latest generated statement PDF with a summary in the email body.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-slate-700 hover:bg-slate-100"
            onClick={() => setShowAddRow(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add recipient
          </Button>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>Send latest PDF</span>
          </div>
        </div>
      )}
    </div>
  );
}
