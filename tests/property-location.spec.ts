import { test, expect } from '@playwright/test'

// This test stubs backend calls to exercise the LocationCard edit flow end-to-end
// without depending on a real database or auth. It validates the request payload
// sent to PUT /api/properties/:id.

test.describe('Property Location – edit flow', () => {
  test('edits location fields and saves', async ({ page }) => {
    const propertyId = 'demo'
    const base = `/properties/${propertyId}/summary`

    // Intercept internal API calls used by the summary/details page
    await page.route('**/api/properties/demo/details**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: propertyId,
          name: 'Demo Property',
          address_line1: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          postal_code: '94105',
          country: 'United States',
          status: 'Active',
          property_type: 'Residential',
          reserve: 0,
          year_built: null,
          units: [],
          owners: [
            { owner_id: 'owner-1', first_name: 'Alice', last_name: 'Owner', ownership_percentage: 100, disbursement_percentage: 100, primary: true }
          ],
          units_summary: { total: 0, occupied: 0, available: 0 },
          occupancy_rate: 0,
        })
      })
    })

    await page.route('**/api/properties/demo/financials**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cash_balance: 0, security_deposits: 0, reserve: 0, available_balance: 0, as_of: new Date().toISOString() }) })
    })

    // CSRF is fetched before save
    await page.route('**/api/csrf', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'test-csrf' }) })
    })

    // Capture and validate the PUT payload
    let capturedBody: any = null
    await page.route('**/api/properties/demo', async (route) => {
      const req = route.request()
      const body = req.postDataJSON() as any
      capturedBody = body
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, property: { id: propertyId } }) })
    })

    await page.goto(base)

    // Open Location card for editing
    const card = page.getByRole('region', { name: /Location/i })
    await card.getByRole('button', { name: /Edit/i }).click()

    // Fill in fields
    await card.getByLabel('Borough').fill('Manhattan')
    await card.getByLabel('Neighborhood').fill('Upper West Side')
    await card.getByLabel('Longitude').fill('-73.985700')
    await card.getByLabel('Latitude').fill('40.748400')

    // Save
    await card.getByRole('button', { name: /^Save$/ }).click()

    // Assert the outgoing payload normalization performed by LocationCard
    await expect.poll(() => capturedBody).not.toBeNull()
    expect(capturedBody.name).toBe('Demo Property')
    expect(capturedBody.address_line1).toBe('123 Main St')
    expect(capturedBody.borough).toBe('Manhattan')
    expect(capturedBody.neighborhood).toBe('Upper West Side')
    expect(capturedBody.longitude).toBe(-73.9857)
    expect(capturedBody.latitude).toBe(40.7484)
    expect(capturedBody.location_verified).toBeDefined()
  })
})

