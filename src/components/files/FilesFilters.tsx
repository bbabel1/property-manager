'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Search, X } from 'lucide-react';
import { cn } from '@/components/ui/utils';

interface FilesFiltersProps {
  search: string;
  categoryId: string;
  dateFrom?: string;
  dateTo?: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  onClearFilters: () => void;
  categoryOptions: { id: string; name: string }[];
  className?: string;
  variant?: 'card' | 'embedded';
}

const ALL_CATEGORY_OPTION_VALUE = '__all_categories__';

export default function FilesFilters({
  search,
  categoryId,
  dateFrom = '',
  dateTo = '',
  onSearchChange,
  onCategoryChange,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
  categoryOptions,
  className,
  variant = 'card',
}: FilesFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const hasActiveFilters = Boolean(search || categoryId || dateFrom || dateTo);

  return (
    <div
      className={cn(
        variant === 'card' ? 'bg-card rounded-lg border p-4' : 'px-4 py-4 sm:px-6',
        className,
      )}
      role="search"
      aria-label="File filters"
    >
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Search Input */}
        <div className="relative w-full min-w-[200px] flex-1 sm:w-auto">
          <label htmlFor="file-search" className="text-sm font-medium text-foreground">
            Search
          </label>
          <Search className="text-muted-foreground pointer-events-none absolute top-[2.75rem] left-3 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
          <Input
            id="file-search"
            type="text"
            placeholder="Search files..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="mt-1 pl-9"
            aria-label="Search files by name, title, or description"
          />
        </div>

        {/* Category Filter */}
        <div className="w-full min-w-[180px] sm:w-auto">
          <label htmlFor="category-filter" className="text-sm font-medium text-foreground">
            Category
          </label>
          <Select
            value={categoryId || ALL_CATEGORY_OPTION_VALUE}
            onValueChange={(value) => onCategoryChange(value === ALL_CATEGORY_OPTION_VALUE ? '' : value)}
          >
            <SelectTrigger
              id="category-filter"
              aria-label="Filter by category"
              className="mt-1"
            >
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORY_OPTION_VALUE}>All Categories</SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filters */}
        {(onDateFromChange || onDateToChange) && (
          <>
            <div className="min-w-[150px]">
              <label htmlFor="file-date-from" className="text-sm font-medium text-foreground">
                Uploaded From
              </label>
              <div className="mt-1">
                <DateInput
                  id="file-date-from"
                  value={dateFrom}
                  onChange={(nextValue) => onDateFromChange?.(nextValue)}
                />
              </div>
            </div>
            <div className="min-w-[150px]">
              <label htmlFor="file-date-to" className="text-sm font-medium text-foreground">
                Uploaded To
              </label>
              <div className="mt-1">
                <DateInput
                  id="file-date-to"
                  value={dateTo}
                  onChange={(nextValue) => onDateToChange?.(nextValue)}
                />
              </div>
            </div>
          </>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground"
          >
            <X className="mr-2 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
