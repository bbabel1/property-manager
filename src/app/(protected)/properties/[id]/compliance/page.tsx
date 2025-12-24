import PropertyComplianceView from './ComplianceView'

type PageProps = {
  params?: Promise<{ id?: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default function PropertyCompliancePage(_props: PageProps) {
  return <PropertyComplianceView />
}
