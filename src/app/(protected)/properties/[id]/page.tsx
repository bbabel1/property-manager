import { redirect } from 'next/navigation'
import { resolvePropertyIdentifier } from '@/lib/public-id-utils'

export default async function PropertyIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { publicId } = await resolvePropertyIdentifier(id)
  redirect(`/properties/${publicId}/summary`)
}
