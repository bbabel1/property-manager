#!/usr/bin/env node
/*
  Sync Buildium bank accounts into local Postgres.
  - Uses .env.local for BUILDIUM_* and LOCAL_DB_URL
  - Inserts/updates gl_accounts as needed
  - Upserts bank_accounts by buildium_bank_id
*/
// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' })
} catch {}
try {
  require('dotenv').config()
} catch {}
const { Client } = require('pg')

function env(name, def) {
  return process.env[name] || def
}

const BUILDIUM_BASE_URL = env('BUILDIUM_BASE_URL', 'https://apisandbox.buildium.com/v1')
const BUILDIUM_CLIENT_ID = env('BUILDIUM_CLIENT_ID', '')
const BUILDIUM_CLIENT_SECRET = env('BUILDIUM_CLIENT_SECRET', '')
if (!BUILDIUM_CLIENT_ID || !BUILDIUM_CLIENT_SECRET) {
  console.error('Missing BUILDIUM_CLIENT_ID or BUILDIUM_CLIENT_SECRET in environment')
  process.exit(1)
}

const LOCAL_DB_URL = env('LOCAL_DB_URL', 'postgres://postgres:postgres@localhost:54322/postgres')

async function bfetch(path, params) {
  const q = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) q.append(k, String(v))
    }
  }
  const url = `${BUILDIUM_BASE_URL}${path}${q.toString() ? `?${q.toString()}` : ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-buildium-client-id': BUILDIUM_CLIENT_ID,
      'x-buildium-client-secret': BUILDIUM_CLIENT_SECRET,
    }
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : undefined } catch { json = undefined }
  if (!res.ok) {
    const msg = `Buildium GET ${path} -> ${res.status} ${res.statusText} ${text?.slice(0,200) || ''}`
    throw new Error(msg)
  }
  return json
}

function mapBankTypeFromBuildium(t) {
  switch (t) {
    case 'MoneyMarket': return 'money_market'
    case 'CertificateOfDeposit': return 'certificate_of_deposit'
    case 'Savings': return 'savings'
    default: return 'checking'
  }
}

function mapCountryFromBuildium(country) {
  if (!country) return 'United States'
  // handle common Buildium concatenations
  if (country === 'UnitedStates') return 'United States'
  if (country === 'UnitedKingdom') return 'United Kingdom'
  if (country === 'UnitedArabEmirates') return 'United Arab Emirates'
  // Fallback: insert spaces between camel-case words
  try { return country.replace(/([a-z])([A-Z])/g, '$1 $2') } catch { return String(country) }
}

async function ensureGLAccount(pg, gl) {
  if (!gl || !gl.Id) return null
  const sel = await pg.query('SELECT id FROM public.gl_accounts WHERE buildium_gl_account_id = $1', [gl.Id])
  if (sel.rows.length) return sel.rows[0].id
  const now = new Date().toISOString()
  const subAccounts = Array.isArray(gl.SubAccounts) ? gl.SubAccounts.map(s => String(s.Id)) : []
  const ins = await pg.query(
    `INSERT INTO public.gl_accounts (
      buildium_gl_account_id, account_number, name, description, type, sub_type,
      is_default_gl_account, default_account_name, is_contra_account, is_bank_account,
      cash_flow_classification, exclude_from_cash_balances, is_active,
      buildium_parent_gl_account_id, sub_accounts, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,$10,
      $11,$12,$13,
      $14,$15,$16,$17
    ) RETURNING id`,
    [
      gl.Id,
      gl.AccountNumber || null,
      gl.Name || 'GL Account',
      gl.Description || null,
      gl.Type || 'Asset',
      gl.SubType || null,
      gl.IsDefaultGLAccount ?? null,
      gl.DefaultAccountName || null,
      gl.IsContraAccount ?? null,
      gl.IsBankAccount ?? null,
      gl.CashFlowClassification || null,
      gl.ExcludeFromCashBalances ?? null,
      gl.IsActive ?? true,
      gl.ParentGLAccountId || null,
      subAccounts,
      now,
      now
    ]
  )
  return ins.rows[0].id
}

async function main() {
  const pg = new Client({ connectionString: LOCAL_DB_URL })
  await pg.connect()
  const pageSize = 200
  let offset = 0
  let fetched = 0
  const summary = { inserted: 0, updated: 0, failed: 0 }
  try {
    for (;;) {
      const accounts = await bfetch('/bankaccounts', { limit: pageSize, offset })
      if (!Array.isArray(accounts) || accounts.length === 0) break
      fetched += accounts.length
      for (const acct of accounts) {
        try {
          let glId = null
          if (acct.GLAccount && acct.GLAccount.Id) {
            // Ensure GL account exists locally; fetch if needed
            glId = await ensureGLAccount(pg, acct.GLAccount)
            if (!glId) {
              const remoteGL = await bfetch(`/glaccounts/${acct.GLAccount.Id}`)
              glId = await ensureGLAccount(pg, remoteGL)
            }
          }
          const now = new Date().toISOString()
          const row = {
            buildium_bank_id: acct.Id,
            name: acct.Name,
            description: acct.Description || null,
            bank_account_type: mapBankTypeFromBuildium(acct.BankAccountType),
            account_number: acct.AccountNumberUnmasked || acct.AccountNumber || null,
            routing_number: acct.RoutingNumber || null,
            is_active: acct.IsActive !== false,
            buildium_balance: typeof acct.Balance === 'number' ? acct.Balance : 0,
            gl_account: glId,
            country: mapCountryFromBuildium(acct.Country) || 'United States',
            check_printing_info: (acct.CheckPrintingInfo ?? null),
            electronic_payments: (acct.ElectronicPayments ?? null),
            last_source: 'buildium',
            last_source_ts: now,
            updated_at: now,
          }

          // Upsert by buildium_bank_id
          const sel = await pg.query('SELECT id FROM public.bank_accounts WHERE buildium_bank_id = $1', [acct.Id])
          if (sel.rows.length) {
            await pg.query(
              `UPDATE public.bank_accounts SET
                name=$1, description=$2, bank_account_type=$3, account_number=$4, routing_number=$5,
                is_active=$6, buildium_balance=$7, gl_account=COALESCE($8, gl_account), country=$9,
                check_printing_info=$10, electronic_payments=$11, last_source=$12, last_source_ts=$13, updated_at=$14
               WHERE id=$15`,
              [
                row.name, row.description, row.bank_account_type, row.account_number, row.routing_number,
                row.is_active, row.buildium_balance, row.gl_account, row.country,
                row.check_printing_info, row.electronic_payments, row.last_source, row.last_source_ts, row.updated_at,
                sel.rows[0].id
              ]
            )
            summary.updated++
          } else {
            await pg.query(
              `INSERT INTO public.bank_accounts (
                buildium_bank_id, name, description, account_number, routing_number,
                created_at, updated_at, is_active, buildium_balance, gl_account, country,
                check_printing_info, electronic_payments, last_source, last_source_ts, bank_account_type
              ) VALUES (
                $1,$2,$3,$4,$5,
                $6,$7,$8,$9,$10,$11,
                $12,$13,$14,$15,$16
              )`,
              [
                row.buildium_bank_id, row.name, row.description, row.account_number, row.routing_number,
                now, row.updated_at, row.is_active, row.buildium_balance, row.gl_account, row.country,
                row.check_printing_info, row.electronic_payments, row.last_source, row.last_source_ts, row.bank_account_type
              ]
            )
            summary.inserted++
          }
        } catch (e) {
          summary.failed++
          console.warn('Failed to upsert account', acct?.Id, (e && e.message) || e)
        }
      }
      if (accounts.length < pageSize) break
      offset += pageSize
    }
    console.log(JSON.stringify({ fetched, ...summary }, null, 2))
  } finally {
    await pg.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
