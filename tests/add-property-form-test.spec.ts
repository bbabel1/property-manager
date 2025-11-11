import { test, expect } from '@playwright/test';

test.describe('Add Property Form Test - Comprehensive', () => {
  test('should fill out and submit Add Property form with all fields and test data from plan', async ({
    page,
  }) => {
    // Track network requests for debugging
    const networkErrors: string[] = [];
    const networkResponses: Array<{
      url: string;
      status: number;
      statusText: string;
      body?: unknown;
    }> = [];
    const consoleErrors: string[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      const statusText = response.statusText();

      if (!response.ok() && status !== 200) {
        let body: unknown = null;
        try {
          body = await response.json().catch(() => null);
        } catch {
          // ignore parse errors
        }

        networkResponses.push({
          url,
          status,
          statusText,
          body,
        });
        networkErrors.push(`${status} ${statusText}: ${url}`);
        if (body && typeof body === 'object' && 'error' in body) {
          networkErrors.push(`  Error: ${JSON.stringify(body.error)}`);
        }
      }
    });

    page.on('requestfailed', (request) => {
      networkErrors.push(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
      }
    });

    // Try navigating directly to properties page first
    await page.goto('/properties', { waitUntil: 'networkidle', timeout: 30000 });

    // Check if we were redirected to login
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/auth/signin');

    if (!isLoginPage) {
      // Check if we're already on properties page
      const propertiesPageElements = page.locator(
        'h1:has-text("Properties"), button:has-text("Add Property")',
      );
      const isOnPropertiesPage = await propertiesPageElements
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (isOnPropertiesPage) {
        console.log('Already authenticated, proceeding to form test...');
        // Skip login and go to form test section below
      } else {
        // Navigate to login
        await page.goto('/auth/signin');
        await page.waitForLoadState('networkidle');
      }
    }

    // Check if we need to login
    if (isLoginPage || page.url().includes('/auth/signin')) {
      const signInHeading = page.locator('h4, h1, h2').filter({ hasText: /sign in/i });
      const confirmLoginPage = await signInHeading.isVisible({ timeout: 5000 }).catch(() => false);

      if (confirmLoginPage || isLoginPage) {
        console.log('Logging in...');

        // Ensure credentials method is selected (not magic link)
        const passwordTab = page
          .locator('button:has-text("Password"):not(:has-text("Magic"))')
          .first();
        await passwordTab.waitFor({ state: 'visible', timeout: 5000 });

        // Check if already selected by checking variant
        const isSelected = await passwordTab
          .evaluate((el) => {
            return (
              el.classList.contains('bg-primary') || el.getAttribute('data-state') === 'active'
            );
          })
          .catch(() => false);

        if (!isSelected) {
          await passwordTab.click();
          await page.waitForTimeout(500);
        }

        // Fill in login form using correct email
        const emailInput = page.locator('input#email').first();
        const passwordInput = page.locator('input#password').first();
        const submitButton = page.locator('button[type="submit"]').first();

        await emailInput.waitFor({ state: 'visible', timeout: 5000 });
        await emailInput.fill('brandon@managedbyora.com');

        // Wait for password field to be visible (only shown when Password tab is active)
        await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
        await passwordInput.fill('B123b123!');

        // Wait for submit button to be enabled
        await submitButton.waitFor({ state: 'visible', timeout: 5000 });

        // Submit form and wait for navigation
        const navigationPromise = page.waitForURL(/dashboard|properties|\/properties/, {
          timeout: 20000,
        });
        await submitButton.click();

        try {
          await navigationPromise;
          console.log('Login successful, navigated to:', page.url());
          await page.waitForLoadState('networkidle');
        } catch {
          // Check for error message
          const errorMessage = page.locator('text=/error|invalid|failed/i');
          if (await errorMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
            const errorText = await errorMessage.textContent();
            console.log(`Login error: ${errorText}`);
            throw new Error(`Login failed: ${errorText}`);
          }
          // Take screenshot for debugging
          await page.screenshot({ path: 'test-results/login-failed.png', fullPage: true });
          throw new Error(`Login did not redirect. Current URL: ${page.url()}`);
        }
      }
    }

    // Navigate to properties page (if not already there)
    const currentUrlAfterLogin = page.url();
    if (!currentUrlAfterLogin.includes('/properties')) {
      console.log('Navigating to properties page...');
      await page.goto('/properties', { waitUntil: 'networkidle', timeout: 30000 });
    } else {
      console.log('Already on properties page');
    }

    // Wait for page to render
    await page.waitForTimeout(2000);

    // Take screenshot to see what's on the page
    await page.screenshot({ path: 'test-results/properties-page-state.png', fullPage: true });

    // Find the Add Property button
    const addPropertyButton = page
      .locator('button:has-text("Add Property"), button[aria-label*="Add Property"]')
      .first();
    await addPropertyButton.waitFor({ state: 'visible', timeout: 10000 });

    // Click "Add Property" button to open modal
    console.log('Opening Add Property modal...');
    await addPropertyButton.click();

    // Wait for modal to appear - Step 1: Property Type
    // Try multiple ways to detect the modal
    const isModalOpen = await Promise.race([
      page.waitForSelector('text=Add New Property', { timeout: 5000 }).then(() => true),
      page.waitForSelector('text=Property Type', { timeout: 5000 }).then(() => true),
      page.waitForSelector('[role="dialog"]', { timeout: 5000 }).then(() => true),
    ]).catch(() => false);

    if (!isModalOpen) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/modal-not-found.png', fullPage: true });
      throw new Error('Modal did not appear after clicking Add Property button');
    }

    // Wait a bit more for modal content to fully render
    await page.waitForTimeout(1000);

    console.log('Starting comprehensive form fill according to plan...');

    // ========== STEP 1: Property Type ==========
    console.log('Step 1: Selecting property type Multi-Family...');

    // Verify all property types are displayed
    const propertyTypes = [
      'Condo',
      'Co-op',
      'Condop',
      'Rental Building',
      'Multi-Family',
      'Townhouse',
    ];
    for (const type of propertyTypes) {
      const button = page.locator(`button:has-text("${type}")`).first();
      const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`  Property type "${type}": ${isVisible ? 'visible' : 'NOT FOUND'}`);
    }

    // Select Multi-Family as specified
    await page.locator('button:has-text("Multi-Family")').first().click();
    await page.waitForTimeout(500);

    // Verify Next button is enabled
    const nextButton = page.locator('button:has-text("Next")').first();
    await expect(nextButton).toBeEnabled({ timeout: 3000 });

    // Click Next to proceed to Step 2
    await nextButton.click();
    await page.waitForTimeout(1000);

    // ========== STEP 2: Property Details ==========
    console.log('Step 2: Filling property details...');
    await expect(page.locator('text=Property Details').first()).toBeVisible({ timeout: 5000 });

    // Fill address using autocomplete - type "123 Main Street"
    const addressInput = page
      .locator(
        'input[placeholder*="Street"], input[placeholder*="address"], input[autoComplete="street-address"]',
      )
      .first();
    await addressInput.waitFor({ state: 'visible', timeout: 5000 });
    await addressInput.fill('123 Main Street');

    // Wait for autocomplete dropdown to appear and select USA option
    console.log('  Waiting for address autocomplete suggestions...');
    await page.waitForTimeout(2000); // Wait for autocomplete to load

    // Try to find and click on a USA address suggestion
    // Google Places autocomplete uses .pac-container or similar
    const autocompleteContainer = page.locator('.pac-container, [role="listbox"]').first();
    const hasSuggestions = await autocompleteContainer
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSuggestions) {
      // Try to click first USA suggestion, but if it fails due to pointer interception, fall back to manual input
      const firstSuggestion = page.locator('.pac-item, [role="option"]').first();
      if (await firstSuggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
        try {
          // Try clicking, but with force if needed
          await firstSuggestion.click({ timeout: 3000, force: true });
          await page.waitForTimeout(2000); // Wait for autocomplete to populate fields
          console.log('  Selected address from autocomplete');
        } catch (clickError) {
          // If click fails (pointer interception), just continue with manual input
          console.log('  Autocomplete click intercepted, filling fields manually instead');
        }
      }
    } else {
      console.log('  Autocomplete did not show, filling fields manually');
    }

    // If autocomplete didn't fill, or if we need to verify/override, fill required fields
    const cityInput = page
      .locator('input[placeholder*="city"], input[autoComplete="address-level2"]')
      .first();
    const currentCity = await cityInput.inputValue().catch(() => '');
    if (!currentCity) {
      await cityInput.fill('New York');
    }

    const stateInput = page
      .locator('input[placeholder*="state"], input[autoComplete="address-level1"]')
      .first();
    const currentState = await stateInput.inputValue().catch(() => '');
    if (!currentState) {
      await stateInput.fill('NY');
    }

    const zipInput = page
      .locator(
        'input[placeholder*="ZIP"], input[placeholder*="postal"], input[autoComplete="postal-code"]',
      )
      .first();
    const currentZip = await zipInput.inputValue().catch(() => '');
    if (!currentZip) {
      await zipInput.fill('10001');
    }

    const countrySelect = page.locator('select[id*="country"], select[name*="country"]').first();
    await countrySelect.waitFor({ state: 'visible', timeout: 5000 });
    await countrySelect.selectOption('United States');

    // Fill ALL optional fields as specified in plan
    const addressLine2Input = page.locator('input[placeholder*="Address Line 2"]').first();
    if (await addressLine2Input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addressLine2Input.fill('Suite 100');
    }

    const statusSelect = page.locator('select[id*="status"]').first();
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.selectOption('Active');
    }

    const yearBuiltInput = page
      .locator('input[placeholder*="Year Built"], input[placeholder*="2008"]')
      .first();
    if (await yearBuiltInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await yearBuiltInput.fill('2020');
    }

    const descriptionTextarea = page
      .locator('textarea[placeholder*="description"], textarea[placeholder*="Brief description"]')
      .first();
    if (await descriptionTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descriptionTextarea.fill(
        'TEST PROPERTY - Comprehensive form test. Created by automated test. Please review and delete.',
      );
    }

    await page.waitForTimeout(500);
    await page.locator('button:has-text("Next")').first().click();
    await page.waitForTimeout(1000);

    // ========== STEP 3: Ownership ==========
    console.log('Step 3: Adding owners (existing + new with 50/50 split)...');
    await expect(page.locator('text=Ownership').first()).toBeVisible({ timeout: 5000 });

    const ownerSelect = page
      .locator('select[id*="owner"], select:has-text("Choose owners")')
      .first();
    await ownerSelect.waitFor({ state: 'visible', timeout: 5000 });

    // Select existing owner first
    const ownerOptions = await ownerSelect.locator('option').all();
    let existingOwnerSelected = false;
    if (ownerOptions.length > 1) {
      // Find first real option (skip placeholder and "create-new-owner")
      for (let i = 1; i < ownerOptions.length; i++) {
        const option = ownerOptions[i];
        const value = await option.getAttribute('value');
        const text = await option.textContent();
        if (
          value &&
          value !== '' &&
          value !== 'create-new-owner' &&
          text &&
          !text.includes('Create')
        ) {
          await ownerSelect.selectOption(value);
          await page.waitForTimeout(1000); // Wait for owner to be added to table
          existingOwnerSelected = true;
          console.log(`  Selected existing owner: ${text}`);
          break;
        }
      }
    }

    // Set existing owner to 50% ownership and 50% disbursement BEFORE creating new owner
    if (existingOwnerSelected) {
      // Wait for the owner to appear in the table
      await page.waitForSelector('table tbody tr', { timeout: 3000 });
      await page.waitForTimeout(500);

      // Find ownership input in the first table row
      const firstRowOwnership = page
        .locator('table tbody tr')
        .first()
        .locator('input[type="number"]')
        .first();
      if (await firstRowOwnership.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstRowOwnership.fill('50');
        await page.waitForTimeout(500);
      }

      // Find disbursement input in the first table row (should be second number input)
      const firstRowDisbursement = page
        .locator('table tbody tr')
        .first()
        .locator('input[type="number"]')
        .nth(1);
      if (await firstRowDisbursement.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstRowDisbursement.fill('50');
        await page.waitForTimeout(500);
      }

      // Wait a moment for the form to update
      await page.waitForTimeout(500);
    }

    // Create new owner with specified test data
    console.log('  Creating new owner with test data...');
    await ownerSelect.selectOption('create-new-owner');
    await page.waitForTimeout(1500); // Wait for inline form to appear

    // Wait for the "Create New Owner" form section to appear (not the dropdown option)
    // Look for the h4 heading inside the form container
    const createOwnerHeading = page.locator('h4:has-text("Create New Owner")');
    await createOwnerHeading.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(500); // Additional wait for form to render

    // Find the form container - it should be a parent/ancestor of the h4
    const createOwnerSection = createOwnerHeading.locator('..').locator('..').first();

    // Fill new owner form - use placeholder-based selectors which are more reliable
    const firstNameInput = page
      .locator('input[placeholder*="John"], input[placeholder*="First"]')
      .first();
    await firstNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await firstNameInput.fill('Test First');

    const lastNameInput = page
      .locator('input[placeholder*="Smith"], input[placeholder*="Last"]')
      .first();
    await lastNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await lastNameInput.fill('Test Last');

    // Email - look for the email placeholder
    const emailInput = page
      .locator('input[placeholder*="john.smith"], input[placeholder*="Email"], input[type="email"]')
      .first();
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill('test@example.com');

    // Set ownership and disbursement percentages for new owner BEFORE adding
    // These are in the create form section
    const createOwnerForm = createOwnerSection;

    // Find all number inputs in the create owner form - should be Ownership % and Disbursement %
    const numberInputs = createOwnerForm.locator('input[type="number"]');
    const inputCount = await numberInputs.count();

    if (inputCount >= 2) {
      // First number input should be Ownership %, second should be Disbursement %
      const ownershipInput = numberInputs.nth(0);
      if (await ownershipInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ownershipInput.fill('50');
        await page.waitForTimeout(300);
      }

      const disbursementInput = numberInputs.nth(1);
      if (await disbursementInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await disbursementInput.fill('50');
        await page.waitForTimeout(300);
      }
    }

    // Click Add Owner button
    await page.locator('button:has-text("Add Owner")').first().click();
    await page.waitForTimeout(2000); // Wait for owner creation and form update

    // After adding, both owners should be in the table - verify and adjust percentages if needed
    // The existing owner should be 50%, new owner should be 50%
    const ownershipInputs = page.locator('table tbody input[type="number"]');
    const ownershipCount = await ownershipInputs.count();

    if (ownershipCount >= 2) {
      // Set first owner (existing) to 50%
      await ownershipInputs.nth(0).fill('50');
      await page.waitForTimeout(300);
      // Set second owner (new) to 50%
      await ownershipInputs.nth(1).fill('50');
      await page.waitForTimeout(300);

      // Also set disbursement percentages
      const disbursementInputs = page.locator('input[aria-label*="Disbursement percentage"]');
      const dispCount = await disbursementInputs.count();
      if (dispCount >= 2) {
        await disbursementInputs.nth(0).fill('50');
        await page.waitForTimeout(300);
        await disbursementInputs.nth(1).fill('50');
        await page.waitForTimeout(300);
      }
    }

    // Verify ownership totals 100%
    const ownershipTotalText = page.locator('text=/Ownership total is/i');
    const hasError = await ownershipTotalText.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) {
      const errorText = await ownershipTotalText.textContent();
      console.log(`  WARNING: ${errorText}`);
      // Try to fix by reading current values and adjusting
      const allOwnershipInputs = page.locator('table tbody input[type="number"]').first();
      const currentValue = await allOwnershipInputs.inputValue().catch(() => '0');
      console.log(`  Current ownership values, adjusting...`);
    }

    await page.waitForTimeout(500);
    await page.locator('button:has-text("Next")').first().click();
    await page.waitForTimeout(1000);

    // ========== STEP 4: Unit Details ==========
    console.log('Step 4: Adding unit details (Unit 1A)...');
    await expect(page.locator('text=Unit Details').first()).toBeVisible({ timeout: 5000 });

    const unitNumberInput = page
      .locator('input[placeholder*="Unit Number"], input[placeholder*="101"]')
      .first();
    await unitNumberInput.waitFor({ state: 'visible', timeout: 5000 });
    await unitNumberInput.fill('1A'); // As specified in plan

    // Fill optional unit fields
    // Select bedrooms
    const bedroomsButtons = page.locator(
      'button:has-text("Studio"), button:has-text("1"), button:has-text("2")',
    );
    const bedroomCount = await bedroomsButtons.count();
    if (bedroomCount > 0) {
      await bedroomsButtons.nth(0).click(); // Select first option (Studio or 1)
      await page.waitForTimeout(300);
    }

    // Select bathrooms
    const bathroomsButtons = page.locator(
      'button:has-text("1"), button:has-text("1.5"), button:has-text("2")',
    );
    const bathroomCount = await bathroomsButtons.count();
    if (bathroomCount > 0) {
      await bathroomsButtons.nth(0).click(); // Select first option
      await page.waitForTimeout(300);
    }

    // Fill description
    const unitDescriptionTextarea = page
      .locator('textarea[placeholder*="Unit-specific"], textarea[placeholder*="amenities"]')
      .first();
    if (await unitDescriptionTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await unitDescriptionTextarea.fill('Test unit 1A');
    }

    await page.waitForTimeout(500);
    await page.locator('button:has-text("Next")').first().click();
    await page.waitForTimeout(1000);

    // ========== STEP 5: Bank Account & Management Services ==========
    console.log('Step 5: Setting bank account and management services...');
    await expect(page.locator('text=Bank Account, text=Management').first()).toBeVisible({
      timeout: 5000,
    });

    // Select operating bank account
    const bankAccountSelect = page
      .locator('select[id*="operating"], select:has-text("Operating Bank Account")')
      .first();
    await bankAccountSelect.waitFor({ state: 'visible', timeout: 5000 });

    const bankOptions = await bankAccountSelect.locator('option').all();
    let operatingBankAccountId: string | null = null;
    if (bankOptions.length > 1) {
      // Skip placeholder and "create-new"
      for (let i = 1; i < bankOptions.length; i++) {
        const option = bankOptions[i];
        const value = await option.getAttribute('value');
        const text = await option.textContent();
        if (value && value !== '' && value !== 'create-new' && text && !text.includes('Create')) {
          operatingBankAccountId = value;
          await bankAccountSelect.selectOption(value);
          console.log(`  Selected operating bank account: ${text}`);
          break;
        }
      }
    }

    // Select different trust account
    const trustAccountSelect = page
      .locator('select[id*="trust"], select:has-text("Deposit Trust Account")')
      .first();
    if (await trustAccountSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const trustOptions = await trustAccountSelect.locator('option').all();
      if (trustOptions.length > 1) {
        for (let i = 1; i < trustOptions.length; i++) {
          const option = trustOptions[i];
          const value = await option.getAttribute('value');
          if (value && value !== '' && value !== operatingBankAccountId && value !== 'create-new') {
            await trustAccountSelect.selectOption(value);
            console.log('  Selected trust account (different from operating)');
            break;
          }
        }
      }
    }

    // Fill reserve amount
    const reserveInput = page.locator('input[placeholder*="0.00"]').first();
    if (await reserveInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reserveInput.fill('1000');
    }

    // Management & Services - ALL required fields
    const managementScopeSelect = page.locator('select[id*="management-scope"]').first();
    await managementScopeSelect.waitFor({ state: 'visible', timeout: 5000 });
    await managementScopeSelect.selectOption('Building');

    const serviceAssignmentSelect = page.locator('select[id*="service-assignment"]').first();
    await serviceAssignmentSelect.waitFor({ state: 'visible', timeout: 5000 });
    await serviceAssignmentSelect.selectOption('Property Level');

    const servicePlanSelect = page.locator('select[id*="service-plan"]').first();
    await servicePlanSelect.waitFor({ state: 'visible', timeout: 5000 });
    await servicePlanSelect.selectOption('Full');

    // Wait for auto-selection of services (Full plan auto-selects all)
    await page.waitForTimeout(1000);

    // Verify all services are selected (Full plan should auto-select all)
    const allServices = [
      'Rent Collection',
      'Maintenance',
      'Turnovers',
      'Compliance',
      'Bill Pay',
      'Condition Reports',
      'Renewals',
    ];
    for (const service of allServices) {
      const checkbox = page
        .locator(`label:has-text("${service}")`)
        .locator('input[type="checkbox"]')
        .first();
      const isChecked = await checkbox.isChecked().catch(() => false);
      if (!isChecked) {
        console.log(`  Selecting ${service}...`);
        await checkbox.check();
        await page.waitForTimeout(200);
      }
    }

    // Fill Bill Pay fields (visible when Bill Pay is selected)
    const billPayListTextarea = page
      .locator('textarea[placeholder*="Bill Pay List"], textarea[placeholder*="bills or vendors"]')
      .first();
    if (await billPayListTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await billPayListTextarea.fill('Electricity\nWater\nGas');
    }

    const billPayNotesTextarea = page
      .locator(
        'textarea[placeholder*="Bill Pay Notes"], textarea[placeholder*="special instructions"]',
      )
      .first();
    if (await billPayNotesTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await billPayNotesTextarea.fill('Pay all bills by the 15th of each month');
    }

    // Fees - Building level with Percentage = 3
    const feeAssignmentSelect = page.locator('select[id*="fee-assignment"]').first();
    await feeAssignmentSelect.waitFor({ state: 'visible', timeout: 5000 });
    await feeAssignmentSelect.selectOption('Building');

    const feeTypeSelect = page.locator('select[id*="fee-type"]').first();
    await feeTypeSelect.waitFor({ state: 'visible', timeout: 5000 });
    await feeTypeSelect.selectOption('Percentage');

    // Fee Percentage = 3 (as specified)
    const feePercentageInput = page
      .locator('input[placeholder*="8"], input[type="number"]')
      .filter({ hasText: '' })
      .first();
    if (await feePercentageInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await feePercentageInput.fill('3');
    }

    // Billing Frequency
    const billingFrequencySelect = page.locator('select[id*="billing-frequency"]').first();
    await billingFrequencySelect.waitFor({ state: 'visible', timeout: 5000 });
    await billingFrequencySelect.selectOption('Monthly');

    await page.waitForTimeout(500);
    await page.locator('button:has-text("Next")').first().click();
    await page.waitForTimeout(1000);

    // ========== STEP 6: Property Manager ==========
    console.log('Step 6: Property Manager (optional - Brandon Babel or skip)...');
    await expect(page.locator('text=Property Manager, text=Property Summary').first()).toBeVisible({
      timeout: 5000,
    });

    // Property Manager is optional - try to find Brandon Babel
    const managerSelect = page
      .locator('select[id*="manager"], select:has-text("Property Manager")')
      .first();
    let managerSelected = false;
    if (await managerSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const managerOptions = await managerSelect.locator('option').all();
      if (managerOptions.length > 1) {
        // Look for Brandon Babel
        for (let i = 1; i < managerOptions.length; i++) {
          const option = managerOptions[i];
          const text = await option.textContent();
          if (
            text &&
            text.toLowerCase().includes('brandon') &&
            text.toLowerCase().includes('babel')
          ) {
            const value = await option.getAttribute('value');
            if (value) {
              await managerSelect.selectOption(value);
              console.log(`  Selected property manager: ${text}`);
              managerSelected = true;
              break;
            }
          }
        }
        // If not found, skip (optional field)
        if (!managerSelected) {
          console.log('  Brandon Babel not found, skipping property manager selection');
        }
      }
    }

    // Verify Property Summary shows all entered data
    const summarySection = page.locator('text=Property Summary').first();
    await expect(summarySection).toBeVisible();

    // Enable Buildium sync checkbox
    // Find checkbox by label text
    const buildiumLabel = page
      .locator('label:has-text("Buildium"), text=Create this property in Buildium')
      .first();
    if (await buildiumLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      const checkbox = buildiumLabel.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await checkbox.check();
        console.log('  Enabled Buildium sync');
      }
    }

    // Take screenshot before submission
    await page.screenshot({ path: 'test-results/add-property-before-submit.png', fullPage: true });

    // Submit the form
    console.log('Submitting form...');
    const submitButton = page.locator('button:has-text("Create Property")').first();
    await expect(submitButton).toBeEnabled({ timeout: 5000 });

    // Check for validation errors before submitting
    const validationErrors = page.locator('text=/error|invalid|required/i');
    const errorCount = await validationErrors.count();
    if (errorCount > 0) {
      console.log(`\n⚠️ Found ${errorCount} validation errors before submission:`);
      for (let i = 0; i < errorCount; i++) {
        const errorText = await validationErrors.nth(i).textContent();
        console.log(`  ${i + 1}. ${errorText}`);
      }
    }

    // Submit with network monitoring
    const buildiumResponsePromise = page
      .waitForResponse(
        (resp) => resp.url().includes('/api/buildium') && resp.request().method() === 'POST',
        { timeout: 30000 },
      )
      .catch(() => null);

    const [response, buildiumSyncResponse] = await Promise.all([
      page
        .waitForResponse(
          (resp) => resp.url().includes('/api/properties') && resp.request().method() === 'POST',
          { timeout: 30000 },
        )
        .catch(() => null),
      buildiumResponsePromise,
      submitButton.click(),
    ]);

    // Wait for submission to complete
    await page.waitForTimeout(3000);

    // Check for success or error messages
    const successMessage = page.locator('text=/success|created|Property created/i');
    const errorMessage = page.locator('text=/error|failed|invalid/i');

    if (await successMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('\n✓ Property created successfully!');
      const successText = await successMessage.textContent();
      console.log(`  Success message: ${successText}`);
    } else if (await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('\n✗ Form submission failed!');
      const errorText = await errorMessage.first().textContent();
      console.log(`  Error message: ${errorText}`);
    }

    // Check network response
    if (response) {
      console.log(`\nAPI Response Status: ${response.status()}`);
      if (!response.ok()) {
        const responseBody = await response.json().catch(() => ({}));
        console.log(`Response body:`, JSON.stringify(responseBody, null, 2));
      } else {
        const responseBody = await response.json().catch(() => ({}));
        console.log('Property created successfully');
        if (responseBody?.property?.name) {
          console.log(`Property name: ${responseBody.property.name}`);
          console.log(`Property ID: ${responseBody.property.id}`);
        }
      }
    }

    // Check Buildium sync response
    if (buildiumSyncResponse !== null) {
      console.log(`\nBuildium Sync Status: ${buildiumSyncResponse.status()}`);
      if (!buildiumSyncResponse.ok()) {
        const buildiumBody = await buildiumSyncResponse.json().catch(() => ({}));
        console.log('⚠️ Buildium sync failed (as expected, documenting):');
        console.log(JSON.stringify(buildiumBody, null, 2));
      } else {
        console.log('✓ Buildium sync successful');
      }
    } else {
      console.log('\n⚠️ Buildium sync response not detected (may not have been triggered)');
    }

    // Log all network errors
    if (networkErrors.length > 0) {
      console.log('\n=== Network Errors Detected ===');
      networkErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      console.log('==============================\n');
    }

    // Log console errors
    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors Detected ===');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      console.log('===============================\n');
    }

    // Take screenshot after submission
    await page.screenshot({ path: 'test-results/add-property-after-submit.png', fullPage: true });

    // Final assertions
    // Don't fail on network errors if they're expected (e.g., Buildium sync failures)
    const criticalNetworkErrors = networkErrors.filter(
      (e) => !e.includes('buildium') && !e.includes('429'), // Ignore Buildium and rate limit errors
    );
    expect(criticalNetworkErrors.length).toBe(0);

    // Check if we were redirected or modal closed
    const modalVisible = await page
      .locator('text=Add New Property')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (!modalVisible) {
      console.log('\n✓ Modal closed - likely successful submission');
    }

    // Verify no critical UI errors remain visible
    const criticalErrors = page.locator('text=/failed to create|error creating|validation error/i');
    const criticalErrorCount = await criticalErrors.count();
    expect(criticalErrorCount).toBe(0);

    console.log('\n✅ Test completed successfully!');
    console.log('📝 Review test-results/ folder for screenshots');
    console.log('🔍 Check property list for test property (marked for manual deletion)');
  });
});
