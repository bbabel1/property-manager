import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import FilesFilters from '@/components/files/FilesFilters';

const noop = () => {};

describe('FilesFilters accessibility', () => {
  test('renders visible labels for each filter control', () => {
    render(
      <FilesFilters
        search=""
        categoryId=""
        dateFrom=""
        dateTo=""
        onSearchChange={noop}
        onCategoryChange={noop}
        onDateFromChange={noop}
        onDateToChange={noop}
        onClearFilters={noop}
        categoryOptions={[
          { id: 'cat-1', name: 'Leases' },
          { id: 'cat-2', name: 'Invoices' },
        ]}
      />,
    );

    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/uploaded from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/uploaded to/i)).toBeInTheDocument();
  });

  test('hides optional controls and their labels when not provided', () => {
    render(
      <FilesFilters
        search=""
        categoryId=""
        onSearchChange={noop}
        onCategoryChange={noop}
        onClearFilters={noop}
        categoryOptions={[]}
      />,
    );

    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/uploaded from/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/uploaded to/i)).not.toBeInTheDocument();
  });
});
