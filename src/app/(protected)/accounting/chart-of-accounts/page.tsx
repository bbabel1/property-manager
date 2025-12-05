import ChartOfAccountsTable from '@/components/financials/ChartOfAccountsTable';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';

export const dynamic = 'force-dynamic';

export default function ChartOfAccountsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Chart of accounts"
        description="Review your general ledger accounts, their classifications, and defaults."
      />
      <PageBody>
        <ChartOfAccountsTable />
      </PageBody>
    </PageShell>
  );
}
