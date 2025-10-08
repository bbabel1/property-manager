import { test, expect } from '@playwright/test'

// Validate PropertyDetailsCard core flows: image fetch fallback and save payload
test.describe('Property Details – core edit', () => {
  test('loads details, shows image fallback, and saves address + manager', async ({ page }) => {
    const propertyId = 'demo'
    const base = `/properties/${propertyId}/summary`

    // API bootstrap: details include owners 100% for save enable
    await page.route('**/api/properties/demo/details**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: propertyId,
          name: 'Demo Property',
          address_line1: '123 Main St', city: 'Anytown', state: 'CA', postal_code: '94105', country: 'United States',
          status: 'Active', property_type: 'Residential', reserve: 0,
          owners: [{ owner_id: 'owner-1', first_name: 'Alice', last_name: 'Owner', ownership_percentage: 100, disbursement_percentage: 100, primary: true }],
          units: [], units_summary: { total: 0, occupied: 0, available: 0 }, occupancy_rate: 0
        })
      })
    })
    await page.route('**/api/properties/demo/financials**', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cash_balance: 0, security_deposits: 0, reserve: 0, available_balance: 0, as_of: new Date().toISOString() }) })
    })

    // Image GET returns lower-case href (our UI now falls back correctly)
    await page.route('**/api/buildium/properties/demo/images**', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ href: 'https://example.com/demo.jpg' }] }) })
    })

    // Staff + owners lists in edit mode
    await page.route('**/api/staff**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 1, role: 'PROPERTY_MANAGER', first_name: 'Pat', last_name: 'Manager' }
    ]) }))
    await page.route('**/api/owners**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'owner-1', displayName: 'Alice Owner' }
    ]) }))
    await page.route('**/api/csrf', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'test-csrf' }) }))

    // Capture PUT /properties/demo save
    let saved: any = null
    await page.route('**/api/properties/demo', (route) => {
      saved = route.request().postDataJSON()
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    })

    await page.goto(base)

    // Confirm image rendered via href fallback
    await expect(page.locator('img[alt="Property"]').first()).toBeVisible()

    // Open details edit (top card) and adjust manager only (owners already 100%)
    const card = page.getByRole('region', { name: /Property Details/i })
    await card.getByRole('button', { name: /Edit/i }).click()
    await card.getByLabel('Property Manager').selectOption('1')

    // Save should be enabled because ownership total is 100
    await card.getByRole('button', { name: /^Save$/ }).click()

    await expect.poll(() => saved).not.toBeNull()
    expect(saved.property_manager_id).toBe('1')
    expect(saved.name).toBe('Demo Property')
    expect(saved.address_line1).toBe('123 Main St')
  })
})

