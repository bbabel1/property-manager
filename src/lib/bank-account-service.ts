import { supabase } from '@/lib/db'
import { resolveBankGlAccountId } from '@/lib/buildium-mappers'
import { normalizeBankAccountType } from '@/lib/gl-bank-account-normalizers'

export type ListBankAccountsParams = {
  limit?: number
  offset?: number
  bankAccountType?: string
  isActive?: boolean
  search?: string
  orgId?: string
}

export class BankAccountService {
  /**
   * Phase 5: Bank accounts are `gl_accounts` rows flagged with `is_bank_account=true`.
   * This service keeps the old name/export for compatibility.
   */
  async list(params: ListBankAccountsParams = {}) {
    let q = supabase
      .from('gl_accounts')
      .select(
        `
        id,
        org_id,
        buildium_gl_account_id,
        name,
        description,
        bank_account_type,
        bank_account_number,
        bank_routing_number,
        bank_country,
        bank_balance,
        bank_buildium_balance,
        is_active,
        created_at,
        updated_at
      `,
      )
      .eq('is_bank_account', true)

    if (params.orgId) q = q.eq('org_id', params.orgId)
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
      .from('gl_accounts')
      .select('*')
      .eq('id', id)
      .eq('is_bank_account', true)
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
    if (payload.accountNumber !== undefined || payload.bank_account_number !== undefined) {
      toUpdate.bank_account_number = payload.accountNumber ?? payload.bank_account_number
    }
    if (payload.routingNumber !== undefined || payload.bank_routing_number !== undefined) {
      toUpdate.bank_routing_number = payload.routingNumber ?? payload.bank_routing_number
    }
    if (payload.isActive !== undefined || payload.is_active !== undefined) {
      toUpdate.is_active = payload.isActive ?? payload.is_active
    }
    if (payload.country !== undefined || payload.bank_country !== undefined) {
      toUpdate.bank_country = payload.country ?? payload.bank_country
    }
    if (payload.balance !== undefined) toUpdate.bank_balance = payload.balance
    if (payload.buildiumBankAccountId !== undefined) {
      toUpdate.buildium_gl_account_id = payload.buildiumBankAccountId
    }

    toUpdate.is_bank_account = true
    toUpdate.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('gl_accounts')
      .update(toUpdate as any)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async importFromBuildium(buildiumBankId: number) {
    const glId = await resolveBankGlAccountId(buildiumBankId, supabase as any)
    if (!glId) {
      throw new Error('Failed to resolve bank account from Buildium')
    }
    const data = await this.get(glId)
    return { mode: 'synced' as const, data }
  }
}

export const bankAccountService = new BankAccountService()
