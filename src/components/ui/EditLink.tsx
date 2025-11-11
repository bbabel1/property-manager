'use client';

import React from 'react';
import { Button, type ButtonProps } from './button';
import { cn } from './utils';

type Props = Omit<ButtonProps, 'variant' | 'children'> & {
  label?: string;
  children?: React.ReactNode;
};

export default function EditLink({
  label = 'Edit',
  className,
  children,
  'aria-label': ariaLabel,
  ...props
}: Props) {
  const content = children ?? label;
  const inferredAria =
    ariaLabel || (typeof content === 'string' ? `Edit ${content.toLowerCase()}` : 'Edit');

  return (
    <Button
      variant="link"
      className={cn('px-1 text-sm font-semibold', className)}
      aria-label={inferredAria}
      {...props}
    >
      {content}
    </Button>
  );
}
