'use client';

import * as React from 'react';

import { cn } from './utils';

type TableDensity = 'compact' | 'comfortable';

const tableDensityRowClasses: Record<TableDensity, string> = {
  compact: 'hover:bg-muted/40 [&>td]:py-2',
  comfortable: 'hover:bg-muted/50 [&>td]:py-4',
};

const tableDensityCellClasses: Record<TableDensity, string> = {
  compact: 'px-4 py-2',
  comfortable: 'px-6 py-4',
};

type TableProps = React.ComponentProps<'table'> & {
  density?: TableDensity;
};

type TableSectionProps<T extends keyof JSX.IntrinsicElements> = React.ComponentProps<T> & {
  density?: TableDensity;
};

type TableRowProps = React.ComponentProps<'tr'> & {
  density?: TableDensity;
};

type TableCellProps = React.ComponentProps<'td'> & {
  density?: TableDensity;
};

function Table({ className, density = 'comfortable', ...props }: TableProps) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        data-density={density}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: TableSectionProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        'bg-muted text-sm tracking-[0.05em] text-muted-foreground uppercase [&>tr]:border-b [&>tr]:bg-transparent [&>tr:hover]:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: TableSectionProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: TableSectionProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, density = 'comfortable', ...props }: TableRowProps) {
  const densityClasses = tableDensityRowClasses[density] ?? tableDensityRowClasses.comfortable;
  return (
    <tr
      data-slot="table-row"
      data-density={density}
      className={cn(
        'border-b border-border transition-colors last:border-b-0 data-[state=selected]:bg-muted',
        densityClasses,
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-muted-foreground h-10 px-3 text-left align-middle font-semibold whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, density = 'comfortable', ...props }: TableCellProps) {
  const densityClasses = tableDensityCellClasses[density] ?? tableDensityCellClasses.comfortable;
  return (
    <td
      data-slot="table-cell"
      data-density={density}
      className={cn(
        'align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        densityClasses,
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  );
}

export type { TableDensity, TableProps, TableRowProps, TableCellProps };
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  tableDensityRowClasses,
  tableDensityCellClasses,
};
