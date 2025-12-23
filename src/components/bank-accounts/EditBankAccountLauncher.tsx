'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import EditBankAccountModal from '@/components/EditBankAccountModal';
import EditLink from '@/components/ui/EditLink';
import type { Database } from '@/types/database';

type LauncherProps = {
  accountId: string;
  initialData: {
    name: string | null;
    description: string | null;
    bank_account_type: string | null;
    bank_account_number: string | null;
    bank_routing_number: string | null;
    bank_country: Database['public']['Enums']['countries'] | null;
    bank_check_printing_info?: Record<string, unknown> | null;
  };
};

export default function EditBankAccountLauncher({ accountId, initialData }: LauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleClose = () => setIsOpen(false);
  const handleSuccess = () => {
    setIsOpen(false);
    router.refresh();
  };

  return (
    <>
      <EditLink onClick={() => setIsOpen(true)} className="px-1 text-sm">
        Edit
      </EditLink>
      <EditBankAccountModal
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
        accountId={accountId}
        initialData={initialData}
      />
    </>
  );
}
