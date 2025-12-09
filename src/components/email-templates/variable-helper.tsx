'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Code2 } from 'lucide-react';
import type { EmailTemplateVariable } from '@/lib/email-templates/variable-definitions';

interface VariableHelperProps {
  variables: EmailTemplateVariable[];
  onInsert: (variableKey: string) => void;
  disabled?: boolean;
}

export function VariableHelper({ variables, onInsert, disabled }: VariableHelperProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Variables');
  const [search, setSearch] = useState('');

  const handleSelect = (variableKey: string) => {
    onInsert(variableKey);
    setOpen(false);
  };

  const grouped = useMemo(() => {
    const categoryMatchers: Array<{ label: string; test: (key: string) => boolean }> = [
      { label: 'Statement', test: (key) => key.startsWith('statement') || key === 'pdfUrl' },
      { label: 'Property', test: (key) => key.startsWith('property') },
      { label: 'Unit', test: (key) => key.startsWith('unit') },
      { label: 'Owner', test: (key) => key.startsWith('owner') || key === 'recipientName' },
      { label: 'Tenant', test: (key) => key.startsWith('tenant') },
      { label: 'Lease', test: (key) => key.startsWith('lease') },
      { label: 'Financial', test: (key) => key.includes('total') || key.includes('balance') || key.includes('amount') || key.includes('net') || key.includes('fee') || key.includes('draw') },
      { label: 'Company', test: (key) => key.startsWith('company') },
      { label: 'Dates & Time', test: (key) => key.startsWith('period') || key.startsWith('current') },
    ];

    const buckets = new Map<string, EmailTemplateVariable[]>();

    const upsert = (label: string, variable: EmailTemplateVariable) => {
      const current = buckets.get(label) ?? [];
      current.push(variable);
      buckets.set(label, current);
    };

    variables.forEach((variable) => {
      const entry = categoryMatchers.find(({ test }) => test(variable.key));
      if (entry) {
        upsert(entry.label, variable);
      } else {
        upsert('General', variable);
      }
    });

    const sorted = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    sorted.unshift(['All Variables', variables]);
    return sorted;
  }, [variables]);

  const filteredVariables = useMemo(() => {
    const activeGroup =
      grouped.find(([label]) => label === selectedCategory)?.[1] ?? variables;

    if (!search.trim()) return activeGroup;

    const query = search.toLowerCase();
    return activeGroup.filter(
      (variable) =>
        variable.key.toLowerCase().includes(query) ||
        variable.description.toLowerCase().includes(query),
    );
  }, [grouped, selectedCategory, search, variables]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          <Code2 className="h-4 w-4" />
          <span>Variable</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[540px] p-4" align="start" sideOffset={6}>
        <div className="flex gap-4">
          <div className="w-48 flex-shrink-0 space-y-2">
            {grouped.map(([label]) => (
              <Button
                key={label}
                variant={label === selectedCategory ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-between"
                onClick={() => setSelectedCategory(label)}
              >
                <span className="text-sm">{label}</span>
                <Badge variant="outline" className="text-[10px]">
                  {(grouped.find(([l]) => l === label)?.[1] ?? []).length}
                </Badge>
              </Button>
            ))}
          </div>

          <div className="flex-1 space-y-3">
            <Input
              placeholder="Search variables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
            <div className="max-h-72 overflow-auto pr-1 space-y-2">
              {filteredVariables.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">No variables found.</p>
              ) : (
                filteredVariables.map((variable) => (
                  <button
                    key={variable.key}
                    onClick={() => handleSelect(variable.key)}
                    className="w-full text-left rounded-md border border-transparent hover:border-border hover:bg-muted/60 p-2 transition"
                  >
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {`{{${variable.key}}}`}
                      </code>
                      {variable.required && (
                        <Badge variant="outline" className="text-[10px]">
                          Required
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {variable.format}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{variable.description}</p>
                    {variable.example && (
                      <p className="text-[11px] text-muted-foreground">
                        Example: {variable.example}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
