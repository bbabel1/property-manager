import { redirect } from 'next/navigation'

export default async function PropertyIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/properties/${id}/summary`)
}
