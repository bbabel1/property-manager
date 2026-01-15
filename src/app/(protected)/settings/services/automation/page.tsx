import { PageBody, PageShell, Stack } from '@/components/layout/page-shell';
import AutomationRulesAdmin from '@/components/settings/AutomationRulesAdmin';
import { Body, Heading } from '@/ui/typography';

export default function AutomationRulesPage() {
  return (
    <PageShell>
      <PageBody>
        <Stack gap="lg">
          <div>
            <Heading as="h1" size="h2">
              Automation Rules Management
            </Heading>
            <Body as="p" tone="muted" size="sm" className="mt-1">
              Configure automation rules for service-based task and charge generation
            </Body>
          </div>
          <AutomationRulesAdmin />
        </Stack>
      </PageBody>
    </PageShell>
  );
}
