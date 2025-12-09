import { PageBody, PageShell, Stack } from '@/components/layout/page-shell';
import AutomationRulesAdmin from '@/components/settings/AutomationRulesAdmin';

export default function AutomationRulesPage() {
  return (
    <PageShell>
      <PageBody>
        <Stack gap="lg">
          <div>
            <h1 className="text-foreground text-2xl font-bold">Automation Rules Management</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Configure automation rules for service-based task and charge generation
            </p>
          </div>
          <AutomationRulesAdmin />
        </Stack>
      </PageBody>
    </PageShell>
  );
}
