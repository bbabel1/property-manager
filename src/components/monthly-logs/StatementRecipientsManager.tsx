/**
 * Statement Recipients Manager Component
 *
 * Allows users to configure email recipients for monthly statement delivery.
 */

'use client';

import { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Recipient {
  email: string;
  name: string;
  role: string;
}

interface StatementRecipientsManagerProps {
  propertyId: string;
}

export default function StatementRecipientsManager({
  propertyId,
}: StatementRecipientsManagerProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // New recipient form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Owner');

  useEffect(() => {
    fetchRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/properties/${propertyId}/statement-recipients`);

      if (!response.ok) {
        throw new Error('Failed to fetch recipients');
      }

      const data = await response.json();
      setRecipients(data.recipients || []);
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

      const response = await fetch(`/api/properties/${propertyId}/statement-recipients`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipients }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save recipients');
      }

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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check for duplicates
    if (recipients.some((r) => r.email.toLowerCase() === newEmail.toLowerCase())) {
      toast.error('This email is already in the recipient list');
      return;
    }

    setRecipients([...recipients, { email: newEmail, name: newName, role: newRole }]);
    setNewEmail('');
    setNewName('');
    setNewRole('Owner');
    setEditing(true);
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r.email !== email));
    setEditing(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Recipients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-slate-200"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email Recipients
          </span>
          {editing && (
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Existing Recipients */}
          {recipients.length > 0 ? (
            <div className="space-y-2">
              {recipients.map((recipient) => (
                <div
                  key={recipient.email}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{recipient.name}</div>
                    <div className="text-sm text-slate-500">{recipient.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      {recipient.role}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRecipient(recipient.email)}
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 p-4 text-amber-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">No recipients configured</p>
                  <p className="text-sm">
                    Add at least one recipient to send statements via email.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Add New Recipient Form */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-700">Add Recipient</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="text-sm"
              />
              <Input
                type="text"
                placeholder="Full Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="text-sm"
              />
              <Input
                type="text"
                placeholder="Role (e.g., Owner)"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button onClick={handleAddRecipient} size="sm" className="w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Recipient
            </Button>
          </div>

          {/* Info */}
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            <p className="font-medium">Recipients will receive:</p>
            <ul className="mt-1 ml-4 list-disc text-xs">
              <li>Monthly statement PDF as attachment</li>
              <li>Financial summary in email body</li>
              <li>Download link for online access</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
