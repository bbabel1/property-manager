import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  getStatementRecipients,
  updateStatementRecipients,
  type StatementRecipient,
} from '@/modules/monthly-logs/services/statement-recipients';

const buildKey = (propertyId?: string) => (propertyId ? ['statementRecipients', propertyId] : null);

export function useStatementRecipients(propertyId?: string) {
  const [actionError, setActionError] = useState<string | null>(null);
  const key = useMemo(() => buildKey(propertyId), [propertyId]);

  const { data, error, isLoading, mutate, isValidating } = useSWR<StatementRecipient[]>(
    key,
    () => getStatementRecipients(propertyId!),
    {
      keepPreviousData: true,
    },
  );

  const handleMutationError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Failed to update recipients';
    setActionError(message);
    return message;
  }, []);

  const persistRecipients = useCallback(
    async (nextRecipients: StatementRecipient[]) => {
      if (!propertyId) return [];

      setActionError(null);

      try {
        const result = await mutate(
          async () => {
            await updateStatementRecipients(propertyId, nextRecipients);
            return nextRecipients;
          },
          {
            optimisticData: nextRecipients,
            rollbackOnError: true,
            populateCache: true,
            revalidate: false,
          },
        );

        return result ?? nextRecipients;
      } catch (err) {
        handleMutationError(err);
        throw err;
      }
    },
    [handleMutationError, mutate, propertyId],
  );

  const addRecipient = useCallback(
    async (recipient: StatementRecipient) => {
      const current = data ?? [];
      return persistRecipients([...current, recipient]);
    },
    [data, persistRecipients],
  );

  const removeRecipient = useCallback(
    async (email: string) => {
      const current = data ?? [];
      return persistRecipients(current.filter((recipient) => recipient.email !== email));
    },
    [data, persistRecipients],
  );

  const refetch = useCallback(() => mutate(), [mutate]);

  const errorMessage = actionError ?? (error ? (error as Error).message || 'Failed to load recipients' : null);

  return {
    recipients: data ?? [],
    isLoading,
    isValidating,
    addRecipient,
    removeRecipient,
    error: errorMessage,
    refetch,
  };
}

export default useStatementRecipients;
