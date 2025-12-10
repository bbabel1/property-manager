'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Edit, Eye } from 'lucide-react';

interface ServicesLeftPanelProps {
  servicePlan: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  categories: string[];
  isEditMode: boolean;
  onEditModeToggle: () => void;
  children: React.ReactNode;
}

export default function ServicesLeftPanel({
  servicePlan,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  categories,
  isEditMode,
  onEditModeToggle,
  children,
}: ServicesLeftPanelProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header with Edit Mode Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Services</h2>
        <Button
          variant={isEditMode ? 'default' : 'outline'}
          size="sm"
          onClick={onEditModeToggle}
          className="flex items-center gap-2"
        >
          {isEditMode ? (
            <>
              <Edit className="h-4 w-4" />
              Edit Mode
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              View Mode
            </>
          )}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <label htmlFor="service-search" className="sr-only">
            Search services
          </label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            id="service-search"
            type="search"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search services"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <label htmlFor="category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="included">Included in Plan</option>
          </select>
        </div>
      </div>

      {/* Service Plan Info - Compact */}
      {servicePlan && (
        <div className="text-muted-foreground mb-3 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
          <span className="font-medium">Plan:</span> {servicePlan}
        </div>
      )}


      {/* Service List - Scrollable */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

