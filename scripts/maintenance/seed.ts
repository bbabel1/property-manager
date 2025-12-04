#!/usr/bin/env -S node --loader tsx
/*
  Seed script for local/staging development.
  - Uses Supabase service role key; DO NOT run against production without intent.
  - Inserts minimal demo data for contacts, owners, properties, units, leases (best-effort).
*/

import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRole)
}

function assertNonProduction() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').toLowerCase()
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SEED_PROD) {
    throw new Error('Refusing to seed in production. Set ALLOW_SEED_PROD=1 to override.')
  }
  if (url.includes('supabase.co') && process.env.REQUIRE_CONFIRM !== 'YES') {
    console.warn('Seeding a remote Supabase project. Set REQUIRE_CONFIRM=YES to continue.')
    process.exit(1)
  }
}

async function upsertContact(supabase: SupabaseClient, email: string, first: string, last: string) {
  const now = new Date().toISOString()
  const payload = {
    is_company: false,
    first_name: first,
    last_name: last,
    primary_email: email,
    created_at: now,
    updated_at: now,
  }
  const { data: existing } = await supabase
    .from('contacts')
    .select('id, primary_email')
    .eq('primary_email', email)
    .maybeSingle()

  if (existing?.id) return existing.id as number

  const { data, error } = await supabase
    .from('contacts')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw error
  return data!.id as number
}

async function upsertOwner(supabase: SupabaseClient, email: string, first: string, last: string) {
  const contactId = await upsertContact(supabase, email, first, last)
  const now = new Date().toISOString()
  const { data: existing } = await supabase
    .from('owners')
    .select('id, contact_id')
    .eq('contact_id', contactId)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const { data, error } = await supabase
    .from('owners')
    .insert({ contact_id: contactId, is_active: true, created_at: now, updated_at: now })
    .select('id')
    .single()
  if (error) throw error
  return data!.id as string
}

async function run() {
  assertNonProduction()
  const supabase = getAdminClient()

  console.log('Seeding demo owners...')
  const owners = [
    { email: 'alice.owner@example.com', first: 'Alice', last: 'Owner' },
    { email: 'bob.owner@example.com', first: 'Bob', last: 'Owner' },
  ]

  for (const o of owners) {
    try {
      const id = await upsertOwner(supabase, o.email, o.first, o.last)
      console.log('Owner upserted:', id, o.email)
    } catch (e: any) {
      console.warn('Owner seed failed:', o.email, e?.message || e)
    }
  }

  // Optional seed for properties/units may require enum/country values.
  // Provide a minimal attempt; skip on error to keep script robust.
  try {
    console.log('Seeding a demo property (best-effort)...')
    const now = new Date().toISOString()
    const { data: prop, error: propErr } = await supabase
      .from('properties')
      .insert({
        name: 'Demo Property',
        address_line1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        postal_code: '94105',
        country: 'United States', // adjust to match your enum if needed
        created_at: now,
        updated_at: now,
      } as any)
      .select('id')
      .single()
    if (propErr) throw propErr
    console.log('Property inserted:', prop?.id)
  } catch (e: any) {
    console.warn('Property seed skipped (adjust country/enum as needed):', e?.message || e)
  }

  console.log('Seed complete.')
}

run().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})

