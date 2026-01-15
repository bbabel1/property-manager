import { PageBody, PageShell, Stack } from '@/components/layout/page-shell';
import ServiceCatalogAdmin from '@/components/settings/ServiceCatalogAdmin';
import { Body, Heading } from '@/ui/typography';

export default function ServiceCatalogAdminPage() {
  return (
    <PageShell>
      <PageBody>
        <Stack gap="lg">
          <div>
            <Heading as="h1" size="h3">
              Service Catalog Administration
            </Heading>
            <Body tone="muted" size="sm" className="mt-1">
              Manage service offerings, plan defaults, and automation rules
            </Body>
          </div>
          <ServiceCatalogAdmin />
        </Stack>
      </PageBody>
    </PageShell>
  );
}
