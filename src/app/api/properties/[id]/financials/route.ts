import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseServerClient()
  const { searchParams } = new URL(req.url)
  const asOf = (searchParams.get("asOf") || new Date().toISOString().slice(0,10))

  const { data, error } = await (supabase as any).rpc("get_property_financials", {
    p_property_id: params.id,
    p_as_of: asOf,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      // short-lived private cache to avoid hammering expensive function
      'Cache-Control': 'private, max-age=30',
    }
  })
}
