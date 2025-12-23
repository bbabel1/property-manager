'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import CreateBankAccountModal from '@/components/CreateBankAccountModal';
import type { BankGlAccountSummary } from '@/components/forms/types';

export default function BankingHeaderActions() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const router = useRouter();

  const handleClose = () => {
    setIsCreateOpen(false);
  };

  const handleCreateSuccess = (newAccount: BankGlAccountSummary) => {
    // Refresh the page so the new account appears in the list
    router.refresh();
    setIsCreateOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add bank account
        </Button>
      </div>

      <CreateBankAccountModal
        isOpen={isCreateOpen}
        onClose={handleClose}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}
