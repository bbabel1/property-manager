'use client';

import { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type Align = 'start' | 'center' | 'end' | 'stretch';
type Justify = 'start' | 'center' | 'end' | 'between';
type Constrain = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type PageColumnsLayout = 'sidebar' | 'balanced';

const gapClasses: Record<Gap, string> = {
  none: 'gap-0',
  xs: 'gap-1.5',
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

const alignClasses: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyClasses: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

const constrainClasses: Record<Exclude<Constrain, 'none'>, string> = {
  sm: 'mx-auto w-full max-w-screen-sm',
  md: 'mx-auto w-full max-w-screen-md',
  lg: 'mx-auto w-full max-w-screen-lg',
  xl: 'mx-auto w-full max-w-screen-xl',
  '2xl': 'mx-auto w-full max-w-screen-2xl',
};

const columnLayoutClasses: Record<PageColumnsLayout, string> = {
  sidebar: 'grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]',
  balanced: 'grid grid-cols-1 lg:grid-cols-2',
};

type StackProps<T extends ElementType> = {
  as?: T;
  gap?: Gap;
  align?: Align;
  justify?: Justify;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

export function Stack<T extends ElementType = 'div'>({
  as,
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  className,
  children,
  ...props
}: StackProps<T>) {
  const Component = as ?? ('div' as ElementType);
  return (
    <Component
      className={cn(
        'flex flex-col',
        gapClasses[gap],
        alignClasses[align],
        justifyClasses[justify],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

type ClusterProps = {
  gap?: Gap;
  align?: Align;
  justify?: Justify;
  wrap?: boolean;
  className?: string;
  children: ReactNode;
};

export function Cluster({
  gap = 'sm',
  align = 'center',
  justify = 'start',
  wrap = true,
  className,
  children,
}: ClusterProps) {
  return (
    <div
      className={cn(
        'flex',
        wrap ? 'flex-wrap' : 'flex-nowrap',
        gapClasses[gap],
        alignClasses[align],
        justifyClasses[justify],
        className,
      )}
    >
      {children}
    </div>
  );
}

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn('flex w-full flex-col gap-6 sm:gap-8', className)}>{children}</div>
  );
}

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  constrain?: Constrain;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
  constrain = 'none',
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'w-full px-2 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6',
        constrain !== 'none' ? constrainClasses[constrain] : undefined,
        className,
      )}
    >
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div className='space-y-2'>
          {eyebrow ? (
            <div className='text-muted-foreground text-xs font-semibold uppercase tracking-wide'>
              {eyebrow}
            </div>
          ) : null}
          <Stack gap='xs'>
            <h1 className='text-foreground text-2xl font-semibold'>{title}</h1>
            {description ? (
              <p className='text-muted-foreground text-base'>{description}</p>
            ) : null}
          </Stack>
        </div>
        {actions ? (
          <Cluster
            gap='sm'
            align='center'
            justify='end'
            className='w-full md:w-auto'
          >
            {actions}
          </Cluster>
        ) : null}
      </div>
      {children ? <div className='mt-6'>{children}</div> : null}
    </div>
  );
}

type PageBodyProps = {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  constrain?: Constrain;
};

export function PageBody({
  children,
  className,
  padded = true,
  constrain = 'none',
}: PageBodyProps) {
  return (
    <div
      className={cn(
        'w-full',
        padded && 'px-2 pb-6 sm:px-4 sm:pb-8 md:px-6 md:pb-10',
        constrain !== 'none' ? constrainClasses[constrain] : undefined,
        className,
      )}
    >
      {children}
    </div>
  );
}

type PageSectionProps = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PageSection({
  title,
  description,
  actions,
  children,
  className,
}: PageSectionProps) {
  return (
    <section className={cn('w-full space-y-4', className)}>
      {(title || description || actions) && (
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            {title ? <h2 className='text-lg font-semibold text-foreground'>{title}</h2> : null}
            {description ? <p className='text-muted-foreground text-sm'>{description}</p> : null}
          </div>
          {actions ? <Cluster gap='sm' justify='end'>{actions}</Cluster> : null}
        </div>
      )}
      {children}
    </section>
  );
}

type PageGridProps = {
  columns?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
};

const columnClasses: Record<2 | 3 | 4, string> = {
  2: 'grid grid-cols-1 gap-6 md:grid-cols-2',
  3: 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4',
};

export function PageGrid({ columns = 3, className, children }: PageGridProps) {
  return <div className={cn(columnClasses[columns], className)}>{children}</div>;
}

type PageColumnsProps = {
  primary: ReactNode;
  secondary?: ReactNode;
  gap?: Gap;
  layout?: PageColumnsLayout;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
};

export function PageColumns({
  primary,
  secondary,
  gap = 'lg',
  layout = 'sidebar',
  className,
  primaryClassName,
  secondaryClassName,
}: PageColumnsProps) {
  return (
    <div className={cn(columnLayoutClasses[layout], gapClasses[gap], className)}>
      <div className={cn('space-y-6', primaryClassName)}>{primary}</div>
      {secondary ? (
        <div className={cn('space-y-6', secondaryClassName)}>{secondary}</div>
      ) : null}
    </div>
  );
}
