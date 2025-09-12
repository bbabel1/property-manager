import { redirect } from 'next/navigation'

export default function PropertyIndex({ params }: { params: { id: string } }) {
  redirect(`/properties/${params.id}/summary`)
}

