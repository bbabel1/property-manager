import InfoCard from '@/components/layout/InfoCard';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import RecordDepositForm from '@/components/bank-accounts/RecordDepositForm';
import { loadRecordDepositPrefill } from '@/server/bank-accounts/record-deposit';

export default async function RecordDepositPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadRecordDepositPrefill(id);

  if (!result.ok) {
    return (
      <PageShell>
        <PageHeader title="Record deposit" />
        <PageBody>
          <InfoCard title="Record deposit">
            <p className="text-sm text-red-600">{result.error}</p>
          </InfoCard>
        </PageBody>
      </PageShell>
    );
  }

  const data = result.data;
  const accountName = data.bankAccountName || 'Bank account';

  return (
    <PageShell>
      <PageHeader
        title="Record deposit"
        description={accountName ? `Bank account: ${accountName}` : undefined}
      />
      <PageBody>
        <RecordDepositForm
          bankAccountId={data.bankAccountId}
          bankAccounts={data.bankAccounts}
          defaultBankAccountId={data.defaultBankAccountId}
          undepositedPaymentsTitle={data.undepositedPaymentsTitle}
          undepositedPayments={data.undepositedPayments}
          properties={data.properties}
          units={data.units}
          glAccounts={data.glAccounts}
        />
      </PageBody>
    </PageShell>
  );
}
