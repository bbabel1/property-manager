import { PageBody, PageShell } from '@/components/layout/page-shell';
import BuildingHeader from '@/components/layout/BuildingHeader';

export default async function BuildingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell>
      <div className="px-2 sm:px-4 md:px-6">
        <BuildingHeader buildingId={id} />
      </div>
      <PageBody className="pt-0">{children}</PageBody>
    </PageShell>
  );
}
