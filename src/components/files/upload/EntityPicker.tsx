import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EntityPickerType =
  | 'property'
  | 'unit'
  | 'lease'
  | 'tenant'
  | 'owner'
  | 'vendor';

type EntityPickerOption = {
  id: string;
  label: string;
  name?: string | null;
  title?: string | null;
  subtitle?: string | null;
  details?: string | null;
  description?: string | null;
};

const LOAD_MORE_LIMIT = 20;
const DEBOUNCE_MS = 300;

export interface EntityPickerProps {
  entityType: EntityPickerType;
  value: string;
  onChange: (nextValue: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  parentId?: string | null;
  className?: string;
  'data-testid'?: string;
  debounceMs?: number;
}

type FetchResult = {
  options: EntityPickerOption[];
  hasMore: boolean;
};

async function fetchEntityOptions(
  entityType: EntityPickerType,
  params: {
    page: number;
    search: string;
    parentId?: string | null;
    signal?: AbortSignal;
  },
): Promise<FetchResult> {
  const query = new URLSearchParams({
    type: entityType,
    limit: String(LOAD_MORE_LIMIT),
    page: String(params.page),
  });

  if (params.search) {
    query.set('search', params.search);
  }

  if (entityType === 'unit' && params.parentId) {
    query.set('propertyId', params.parentId);
  }

  const response = await fetch(`/api/files/entities?${query.toString()}`, {
    method: 'GET',
    signal: params.signal,
    credentials: 'include',
  });

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const message =
      typeof details?.error === 'string'
        ? details.error
        : `Failed to load ${entityType} options`;
    throw new Error(message);
  }

  const payload = await response.json();
  const rawData: EntityPickerOption[] = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  const hasMore: boolean =
    typeof payload?.pagination?.hasMore === 'boolean'
      ? payload.pagination.hasMore
      : rawData.length === LOAD_MORE_LIMIT;

  const options: EntityPickerOption[] = rawData.map((item) => ({
    id: item?.id?.toString?.() ?? String(item?.id ?? ''),
    label: item?.label ?? item?.name ?? item?.title ?? `Item ${item?.id ?? ''}`,
    description: item?.description ?? item?.subtitle ?? item?.details ?? null,
  }));

  return { options, hasMore };
}

export function EntityPicker({
  entityType,
  value,
  onChange,
  label,
  placeholder,
  disabled,
  parentId,
  className,
  'data-testid': dataTestId,
  debounceMs,
}: EntityPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<EntityPickerOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<EntityPickerOption | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const effectiveDebounce = typeof debounceMs === 'number' && debounceMs >= 0 ? debounceMs : DEBOUNCE_MS;

  useEffect(() => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, effectiveDebounce);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [effectiveDebounce, searchTerm]);

  useEffect(() => {
    setPage(1);
    setOptions([]);
    setHasMore(false);
    setError(null);
  }, [entityType, debouncedSearch, parentId]);

  useEffect(() => {
    if (entityType === 'unit' && !parentId) {
      setOptions([]);
      setHasMore(false);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let isCancelled = false;

    setIsLoading(true);
    setError(null);

    fetchEntityOptions(entityType, {
      page,
      search: debouncedSearch,
      parentId,
      signal: controller.signal,
    })
      .then(({ options: incoming, hasMore: incomingHasMore }) => {
        if (isCancelled) return;
        setOptions((prev) => {
          const merged = page === 1 ? incoming : [...prev, ...incoming];
          const seen = new Set<string>();
          return merged.filter((option) => {
            if (seen.has(option.id)) return false;
            seen.add(option.id);
            return true;
          });
        });
        setHasMore(incomingHasMore);

        if (value) {
          const match = incoming.find((option) => option.id === value);
          if (match) {
            setSelectedOption(match);
          }
        }
      })
      .catch((fetchError) => {
        if (isCancelled || controller.signal.aborted) return;
        console.error('EntityPicker fetch failed:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load options');
        setHasMore(false);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [entityType, parentId, page, debouncedSearch, value]);

  useEffect(() => {
    if (!value) {
      setSelectedOption(null);
      return;
    }
    const match = options.find((option) => option.id === value);
    if (match) {
      setSelectedOption(match);
    } else if (selectedOption?.id !== value) {
      setSelectedOption(selectedOption);
    }
  }, [value, options, selectedOption]);

  const selectedLabel = useMemo(() => {
    if (!value) return 'None selected';
    return selectedOption?.label ?? `Selected ID: ${value}`;
  }, [value, selectedOption]);

  const handleLoadMore = () => {
    if (isLoading || !hasMore) return;
    setPage((prev) => prev + 1);
  };

  const handleSelect = (option: EntityPickerOption) => {
    setSelectedOption(option);
    onChange(option.id);
  };

  const isDisabled = Boolean(disabled || (entityType === 'unit' && !parentId));

  return (
    <div className={cn('space-y-2', className)} data-testid={dataTestId}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium leading-6 text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{selectedLabel}</span>
      </div>

      <Input
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder={placeholder ?? 'Search...'}
        disabled={isDisabled}
        className="h-9"
        data-testid={dataTestId ? `${dataTestId}-search` : undefined}
      />

      <div
        className={cn(
          'border bg-background rounded-md',
          'max-h-60 overflow-y-auto divide-y',
          isDisabled && 'opacity-50 pointer-events-none',
        )}
      >
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary-foreground/90'
                  : 'hover:bg-muted',
              )}
            >
              <div className="font-medium text-foreground">{option.label}</div>
              {option.description ? (
                <div className="text-xs text-muted-foreground">{option.description}</div>
              ) : null}
            </button>
          );
        })}

        {!isLoading && options.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {debouncedSearch ? 'No matches found.' : 'No results available.'}
          </div>
        ) : null}

        {isLoading ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLoadMore}
          disabled={isLoading || isDisabled}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}

export default EntityPicker;
