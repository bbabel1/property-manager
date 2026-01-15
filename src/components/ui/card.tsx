'use client';

import * as React from 'react';

import { Body, Heading } from '@/ui/typography';
import type { BodySize, HeadingSize } from '@/ui/typography';
import { cn } from './utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-card text-card-foreground rounded-xl border', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-2 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  headingAs?: React.ElementType;
  headingSize?: HeadingSize;
};

const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ className, headingAs = 'h3', headingSize = 'h4', children, ...props }, ref) => (
    <Heading
      ref={ref as React.Ref<HTMLHeadingElement>}
      as={headingAs}
      size={headingSize}
      className={cn('leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </Heading>
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    bodySize?: BodySize;
    tone?: 'default' | 'muted';
  }
>(({ className, bodySize = 'sm', tone = 'muted', children, ...props }, ref) => (
  <div ref={ref} className={cn('text-left', className)} {...props}>
    <Body as="div" size={bodySize} tone={tone}>
      {children}
    </Body>
  </div>
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 py-4', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
