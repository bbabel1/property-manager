import { redirect } from 'next/navigation';

export default async function AuthIndex({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextParam =
    typeof resolvedSearchParams?.next === 'string' ? resolvedSearchParams?.next : undefined;
  const next = nextParam ? `?next=${encodeURIComponent(nextParam)}` : '';
  redirect(`/auth/signin${next}`);
}
