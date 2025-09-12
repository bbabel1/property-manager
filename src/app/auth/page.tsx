import { redirect } from 'next/navigation'

export default function AuthIndex({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const nextParam = typeof searchParams?.next === 'string' ? searchParams?.next : undefined
  const next = nextParam ? `?next=${encodeURIComponent(nextParam)}` : ''
  redirect(`/auth/signin${next}`)
}

