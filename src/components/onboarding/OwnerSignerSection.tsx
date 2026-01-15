'use client';

import { useState } from 'react';
import { Plus, Trash2, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Body, Label } from '@/ui/typography';

export interface Signer {
  clientRowId: string;
  email: string;
  name: string;
  ownerId?: string;
}

interface OwnerSignerSectionProps {
  signers: Signer[];
  onSignersChange: (signers: Signer[]) => void;
  disabled?: boolean;
}

function generateClientRowId(): string {
  return crypto.randomUUID();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OwnerSignerSection({
  signers,
  onSignersChange,
  disabled = false,
}: OwnerSignerSectionProps) {
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleAddSigner = () => {
    if (!newEmail) {
      setEmailError('Email is required');
      return;
    }

    if (!isValidEmail(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (signers.some((s) => s.email.toLowerCase() === newEmail.toLowerCase())) {
      setEmailError('This email is already in the signer list');
      return;
    }

    const newSigner: Signer = {
      clientRowId: generateClientRowId(),
      email: newEmail,
      name: newName || newEmail.split('@')[0],
    };

    onSignersChange([...signers, newSigner]);
    setNewEmail('');
    setNewName('');
    setEmailError(null);
  };

  const handleRemoveSigner = (clientRowId: string) => {
    onSignersChange(signers.filter((s) => s.clientRowId !== clientRowId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSigner();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Agreement Signers</Label>
        <Body className="text-muted-foreground mt-1 text-sm">
          At least one signer email is required to send the management agreement.
        </Body>
      </div>

      {/* Existing signers list */}
      {signers.length > 0 && (
        <div className="space-y-2">
          {signers.map((signer) => (
            <div
              key={signer.clientRowId}
              className="bg-muted/50 flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                  <User className="text-primary h-4 w-4" />
                </div>
                <div>
                  <Body className="font-medium">{signer.name}</Body>
                  <Body className="text-muted-foreground text-sm">{signer.email}</Body>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveSigner(signer.clientRowId)}
                disabled={disabled}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new signer form */}
      <div className="space-y-3 rounded-md border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="signer-email" className="text-sm">
              Email *
            </Label>
            <div className="relative">
              <Mail className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                id="signer-email"
                type="email"
                placeholder="signer@example.com"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailError(null);
                }}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="pl-9"
              />
            </div>
            {emailError && <Body className="text-destructive text-sm">{emailError}</Body>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="signer-name" className="text-sm">
              Name
            </Label>
            <div className="relative">
              <User className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                id="signer-name"
                type="text"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddSigner}
          disabled={disabled || !newEmail}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Signer
        </Button>
      </div>

      {signers.length === 0 && (
        <Body className="text-muted-foreground text-center text-sm">
          No signers added yet. Add at least one signer to proceed.
        </Body>
      )}
    </div>
  );
}
