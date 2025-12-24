import { PageBody, PageShell, Stack } from '@/components/layout/page-shell';
import ServiceCatalogAdmin from '@/components/settings/ServiceCatalogAdmin';

export default function ServiceCatalogAdminPage() {
  return (
    <PageShell>
      <PageBody>
        <Stack gap="lg">
          <div>
            <h1 className="text-foreground text-2xl font-bold">Service Catalog Administration</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage service offerings, plan defaults, and automation rules
            </p>
          </div>
          <ServiceCatalogAdmin />
        </Stack>
      </PageBody>
    </PageShell>
  );
}
