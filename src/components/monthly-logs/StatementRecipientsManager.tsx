/**
 * Statement Recipients Manager Component
 *
 * Allows users to configure email recipients for monthly statement delivery.
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Info, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { isValidRecipientEmail, type StatementRecipient } from '@/modules/monthly-logs/services/statement-recipients';
import useStatementRecipients from '@/features/monthly-logs/hooks/useStatementRecipients';

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
  const {
    recipients,
    isLoading,
    isValidating,
    addRecipient,
    removeRecipient,
    error,
  } = useStatementRecipients(propertyId);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Owner');
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    onRecipientsChange?.(recipients);
  }, [onRecipientsChange, recipients]);

  useEffect(() => {
    onLoadingChange?.(isLoading || isValidating);
  }, [isLoading, isValidating, onLoadingChange]);

  const handleAddRecipient = async () => {
    if (!newEmail || !newName) {
      toast.error('Email and name are required');
      return;
    }

    if (!isValidRecipientEmail(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (recipients.some((r) => r.email.toLowerCase() === newEmail.toLowerCase())) {
      toast.error('This email is already in the recipient list');
      return;
    }

    const nextRecipient = { email: newEmail, name: newName, role: newRole };

    try {
      setIsMutating(true);
      setActionError(null);
      await addRecipient(nextRecipient);
      setNewEmail('');
      setNewName('');
      setNewRole('Owner');
      toast.success('Recipient added');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add recipient';
      setActionError(message);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleRemoveRecipient = async (email: string) => {
    try {
      setIsMutating(true);
      setActionError(null);
      await removeRecipient(email);
      toast.success('Recipient removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove recipient';
      setActionError(message);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  if (isLoading && recipients.length === 0) {
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
      {(error || actionError) && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div className="space-y-1">
            {error && <p>{error}</p>}
            {actionError && !error && <p>{actionError}</p>}
          </div>
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
                  disabled={isMutating}
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
                disabled={isMutating}
              />
              <Input
                type="text"
                placeholder="Full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 text-sm"
                disabled={isMutating}
              />
              <Input
                type="text"
                placeholder="Role (e.g., Owner)"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="h-9 text-sm"
                disabled={isMutating}
              />
            </div>
            <Button onClick={handleAddRecipient} size="sm" className="h-9 w-full gap-2 sm:w-auto" disabled={isMutating}>
              <Plus className="h-4 w-4" />
              {isMutating ? 'Adding...' : 'Add recipient'}
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
            disabled={isMutating}
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
