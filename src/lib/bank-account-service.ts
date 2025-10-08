import { supabase } from '@/lib/db'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { mapBankAccountFromBuildiumWithGLAccount } from '@/lib/buildium-mappers'

export type ListBankAccountsParams = {
  limit?: number
  offset?: number
  bankAccountType?: string
  isActive?: boolean
  search?: string
}

export function normalizeBankAccountType(input: string | null | undefined): string | null {
  if (!input) return null
  
  const normalized = String(input).trim().toLowerCase()
  
  // Map UI values to database enum values
  if (normalized === 'checking' || normalized === 'business checking') return 'checking'
  if (normalized === 'savings' || normalized === 'business savings') return 'savings'
  if (normalized === 'money market' || normalized === 'money_market' || normalized === 'moneymarket') return 'money_market'
  if (normalized === 'certificate of deposit' || normalized === 'certificate_of_deposit' || normalized === 'cd' || normalized === 'certificateofdeposit') return 'certificate_of_deposit'
  
  // Default fallback
  return 'checking'
}

export class BankAccountService {
  async list(params: ListBankAccountsParams = {}) {
    let q = supabase
      .from('bank_accounts')
      .select(`
        id,
        buildium_bank_id,
        name,
        description,
        bank_account_type,
        account_number,
        routing_number,
        gl_account,
        balance,
        buildium_balance,
        is_active,
        country,
        created_at,
        updated_at
      `)

    if (params.bankAccountType) {
      q = q.eq('bank_account_type', normalizeBankAccountType(params.bankAccountType))
    }
    if (typeof params.isActive === 'boolean') q = q.eq('is_active', params.isActive)
    if (params.search && params.search.trim()) {
      const s = `%${params.search.trim()}%`
      q = q.or(`name.ilike.${s},description.ilike.${s}`)
    }
    q = q.order('name', { ascending: true })
    if (typeof params.offset === 'number' && typeof params.limit === 'number') {
      q = q.range(params.offset, params.offset + params.limit - 1)
    }
    const { data, error } = await q
    if (error) throw error
    return data || []
  }

  async get(id: string) {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  }

  async create(payload: any) {
    const now = new Date().toISOString()
    const toInsert: any = {
      name: payload.name,
      description: payload.description ?? null,
      bank_account_type: normalizeBankAccountType(payload.bankAccountType || payload.bank_account_type || 'checking'),
      account_number: payload.accountNumber || payload.account_number,
      routing_number: payload.routingNumber || payload.routing_number,
      is_active: payload.isActive ?? payload.is_active ?? true,
      gl_account: payload.glAccountId || payload.gl_account,
      balance: payload.balance ?? null,
      buildium_bank_id: payload.buildiumBankId ?? payload.buildium_bank_id ?? undefined,
      country: payload.country || 'United States',
      created_at: now,
      updated_at: now
    }
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert(toInsert as any)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async update(id: string, payload: any) {
    const toUpdate: any = {}
    if (payload.name !== undefined) toUpdate.name = payload.name
    if (payload.description !== undefined) toUpdate.description = payload.description
    if (payload.bankAccountType !== undefined || payload.bank_account_type !== undefined) {
      toUpdate.bank_account_type = normalizeBankAccountType(payload.bankAccountType || payload.bank_account_type)
    }
    if (payload.accountNumber !== undefined || payload.account_number !== undefined) toUpdate.account_number = payload.accountNumber ?? payload.account_number
    if (payload.routingNumber !== undefined || payload.routing_number !== undefined) toUpdate.routing_number = payload.routingNumber ?? payload.routing_number
    if (payload.isActive !== undefined || payload.is_active !== undefined) toUpdate.is_active = payload.isActive ?? payload.is_active
    if (payload.glAccountId !== undefined || payload.gl_account !== undefined) toUpdate.gl_account = payload.glAccountId ?? payload.gl_account
    if (payload.balance !== undefined) toUpdate.balance = payload.balance
    if (payload.buildiumBankId !== undefined || payload.buildium_bank_id !== undefined) toUpdate.buildium_bank_id = payload.buildiumBankId ?? payload.buildium_bank_id
    if (payload.country !== undefined) toUpdate.country = payload.country
    toUpdate.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('bank_accounts')
      .update(toUpdate as any)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async importFromBuildium(buildiumBankId: number) {
    const remote = await buildiumEdgeClient.getBankAccountFromBuildium(buildiumBankId)
    if (!remote.success || !remote.data) {
      throw new Error(remote.error || 'Failed to fetch bank account from Buildium')
    }
    // Map to local shape (with GL resolution)
    const mapped = await mapBankAccountFromBuildiumWithGLAccount(remote.data, supabase)
    const now = new Date().toISOString()
    const finalRow: any = {
      ...mapped,
      country: 'United States', // Buildium does not return Country; default
      updated_at: now
    }

    // Upsert by buildium_bank_id
    const { data: existing, error: findErr } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('buildium_bank_id', buildiumBankId)
      .single()
    if (findErr && findErr.code !== 'PGRST116') throw findErr

    if (existing) {
      const { data, error } = await supabase
        .from('bank_accounts')
        .update(finalRow as any)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return { mode: 'updated' as const, data }
    } else {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({ ...finalRow, created_at: now } as any)
        .select()
        .single()
      if (error) throw error
      return { mode: 'created' as const, data }
    }
  }
}

export const bankAccountService = new BankAccountService()

