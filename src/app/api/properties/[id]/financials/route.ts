import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/guards"
import { resolveResourceOrg, requireOrgMember } from "@/lib/auth/org-guards"
import { fetchPropertyFinancials } from "@/server/financials/property-finance"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth()
    const propertyId = (await params).id
    const resolved = await resolveResourceOrg(supabase, 'property', propertyId)
    if (!resolved.ok) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }
    try {
      await requireOrgMember({ client: supabase, userId: user.id, orgId: resolved.orgId })
    } catch (memberErr) {
      const msg = memberErr instanceof Error ? memberErr.message : ''
      const status = msg === 'ORG_FORBIDDEN' ? 403 : 401
      return NextResponse.json({ error: 'Forbidden' }, { status })
    }

    const { searchParams } = new URL(req.url)
    const asOf = (searchParams.get("asOf") || new Date().toISOString().slice(0,10))

    const { fin } = await fetchPropertyFinancials(propertyId, asOf, supabase as any)

    return new NextResponse(JSON.stringify(fin), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=30',
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    const status = msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: 'Unauthorized' }, { status })
  }
}
