import { test, expect } from '@playwright/test'

test.describe('Property Banking – edit flow', () => {
  test('updates reserve and selects accounts', async ({ page }) => {
    const propertyId = 'demo'
    const base = `/properties/${propertyId}/summary`

    // Bootstrap property details + financials
    await page.route('**/api/properties/demo/details**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: propertyId,
          name: 'Demo Property',
          address_line1: '123 Main St',
          city: 'Anytown', state: 'CA', postal_code: '94105', country: 'United States',
          status: 'Active', property_type: 'Residential', reserve: 0,
          units: [], owners: [{ owner_id: 'owner-1', ownership_percentage: 100, disbursement_percentage: 100, primary: true }],
          units_summary: { total: 0, occupied: 0, available: 0 }, occupancy_rate: 0,
          operating_account: null, deposit_trust_account: null
        })
      })
    })
    await page.route('**/api/properties/demo/financials**', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cash_balance: 0, security_deposits: 0, reserve: 0, available_balance: 0, as_of: new Date().toISOString() }) })
    })

    // Bank accounts list when editing
    await page.route('**/api/bank-accounts**', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 'op-1', name: 'Operating Checking', account_number: '****1234' },
        { id: 'tr-1', name: 'Trust Savings', account_number: '****9876' },
      ]) })
    })

    // Intercept PUT /banking and validate payload
    let capturedBanking: any = null
    await page.route('**/api/properties/demo/banking', (route) => {
      const body = route.request().postDataJSON() as any
      capturedBanking = body
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    })

    await page.goto(base)

    const card = page.getByRole('region', { name: /Banking details/i })
    await card.getByRole('button', { name: /Edit/i }).click()

    // Change reserve and select accounts
    await card.getByLabel('Property Reserve ($)').fill('2500')

    // Open Dropdown components – they’re custom, so use input role fallback
    await card.getByLabel('Operating Bank Account').click()
    await page.getByText('Operating Checking').click()
    await card.getByLabel('Deposit Trust Account').click()
    await page.getByText('Trust Savings').click()

    await card.getByRole('button', { name: /^Save$/ }).click()

    await expect.poll(() => capturedBanking).not.toBeNull()
    expect(capturedBanking.reserve).toBe(2500)
    expect(capturedBanking.operating_bank_account_id).toBe('op-1')
    expect(capturedBanking.deposit_trust_account_id).toBe('tr-1')
  })
})

