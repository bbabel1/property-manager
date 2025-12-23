'use client';

import type { ComponentProps } from 'react';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';

import DepositEditForm from './DepositEditForm';

type DepositEditFormProps = ComponentProps<typeof DepositEditForm>;

type DepositEditFormContainerProps = Omit<DepositEditFormProps, 'onClose' | 'onSaved'> & {
  returnHref?: string;
};

export default function DepositEditFormContainer({
  returnHref,
  ...props
}: DepositEditFormContainerProps) {
  const router = useRouter();
  const hasClosedRef = useRef(false);

  const closeOnce = () => {
    if (hasClosedRef.current) return;
    hasClosedRef.current = true;

    if (returnHref) {
      router.replace(returnHref);
      return;
    }
    router.back();
  };

  const handleClose = () => {
    closeOnce();
  };

  const handleSaved = () => {
    if (!returnHref) {
      router.refresh();
    }
    closeOnce();
  };

  return <DepositEditForm {...props} onClose={handleClose} onSaved={handleSaved} />;
}
