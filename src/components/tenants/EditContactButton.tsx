'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EditTenantContactModal from '@/components/tenants/EditTenantContactModal';
import EditLink from '@/components/ui/EditLink';

type ContactValues = {
  first_name?: string | null;
  last_name?: string | null;
  is_company?: boolean | null;
  company_name?: string | null;
  primary_email?: string | null;
  alt_email?: string | null;
  primary_phone?: string | null;
  alt_phone?: string | null;
  date_of_birth?: string | null;
  primary_address_line_1?: string | null;
  primary_address_line_2?: string | null;
  primary_city?: string | null;
  primary_state?: string | null;
  primary_postal_code?: string | null;
  primary_country?: string | null;
};

export default function EditContactButton({
  contactId,
  initial,
}: {
  contactId: number;
  initial: ContactValues;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ContactValues>(initial);
  const router = useRouter();

  useEffect(() => {
    setCurrent(initial);
  }, [initial]);

  return (
    <>
      <EditLink onClick={() => setOpen(true)} />
      <EditTenantContactModal
        open={open}
        onOpenChange={setOpen}
        contactId={contactId}
        initial={current}
        onSaved={(updated) => {
          setCurrent(updated);
          router.refresh();
        }}
      />
    </>
  );
}
