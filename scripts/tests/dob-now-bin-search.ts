#!/usr/bin/env -S npx tsx
/**
 * Playwright script to navigate to DOB NOW Public Portal and click the BIN search card.
 *
 * This script demonstrates browser automation using Playwright to:
 * 1. Navigate to the DOB NOW Public Portal
 * 2. Click on the "Search by BIN" card
 * 3. Verify the BIN search form appears
 *
 * Usage:
 *   npx tsx scripts/tests/dob-now-bin-search.ts
 *
 * Optional environment variables:
 *   DOB_NOW_URL - Override the default DOB NOW portal URL
 *   HEADLESS - Set to 'false' to run in headed mode (default: 'true')
 *   SLOW_MO - Add delay between actions in milliseconds (default: 0)
 */
import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const DOB_NOW_URL = process.env.DOB_NOW_URL || 'https://a810-dobnow.nyc.gov/publish/Index.html#!/';
const HEADLESS = process.env.HEADLESS !== 'false'; // Default to true
const SLOW_MO = parseInt(process.env.SLOW_MO || '0', 10);

async function navigateToDOBNow(page: Page): Promise<void> {
  console.log(`Navigating to: ${DOB_NOW_URL}`);
  await page.goto(DOB_NOW_URL, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  console.log('✅ Successfully navigated to DOB NOW Public Portal');
}

async function clickBINCard(page: Page): Promise<void> {
  console.log('Looking for BIN search card...');

  // The BIN card can be found by:
  // 1. Image with name "Search by BIN"
  // 2. Button with accessible name "Search by BIN"
  // 3. Or by the image alt/name attribute

  // Try multiple selectors to be robust
  const selectors = [
    'img[name="Search by BIN"]',
    'button:has-text("Search by BIN")',
    'img[alt*="BIN"]',
    '[role="img"][name*="BIN"]',
    'img:has-text("Search by BIN")',
  ];

  let clicked = false;
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`Found BIN card using selector: ${selector}`);
        await element.click({ timeout: 5000 });
        clicked = true;
        console.log('✅ Successfully clicked BIN card');
        break;
      }
    } catch (error) {
      // Try next selector
      continue;
    }
  }

  if (!clicked) {
    // Fallback: try to find by accessible name
    try {
      await page.getByRole('img', { name: /Search by BIN/i }).click({
        timeout: 5000,
      });
      clicked = true;
      console.log('✅ Successfully clicked BIN card (using accessible name)');
    } catch (error) {
      console.error('❌ Could not find or click BIN card');
      throw new Error('Failed to click BIN card. The page structure may have changed.');
    }
  }
}

async function verifyBINFormAppears(page: Page): Promise<boolean> {
  console.log('Verifying BIN search form appears...');

  // Wait for the form to appear
  try {
    // Look for the BIN input field
    const binInput = page.getByLabel('BIN').or(page.getByPlaceholder(/Enter BIN/i));
    await binInput.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ BIN search form is visible');

    // Also check for the search button
    const searchButton = page.getByRole('button', { name: /Search/i }).first();
    if (await searchButton.isVisible({ timeout: 2000 })) {
      console.log('✅ Search button is visible');
    }

    return true;
  } catch (error) {
    console.warn('⚠️  Could not verify BIN form appearance:', error);
    return false;
  }
}

async function takeScreenshot(page: Page, filename: string): Promise<void> {
  try {
    await page.screenshot({
      path: filename,
      fullPage: true,
    });
    console.log(`📸 Screenshot saved: ${filename}`);
  } catch (error) {
    console.warn('⚠️  Could not take screenshot:', error);
  }
}

async function main(): Promise<void> {
  let browser: Browser | null = null;

  try {
    console.log('🚀 Starting Playwright browser automation...');
    console.log(`Configuration:`);
    console.log(`  - URL: ${DOB_NOW_URL}`);
    console.log(`  - Headless: ${HEADLESS}`);
    console.log(`  - Slow Mo: ${SLOW_MO}ms`);

    // Launch browser
    browser = await chromium.launch({
      headless: HEADLESS,
      slowMo: SLOW_MO,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Navigate to DOB NOW
    await navigateToDOBNow(page);

    // Take initial screenshot
    await takeScreenshot(page, 'dob-now-initial.png');

    // Click the BIN card
    await clickBINCard(page);

    // Wait a moment for the form to appear
    await page.waitForTimeout(1000);

    // Verify the form appears
    const formVisible = await verifyBINFormAppears(page);

    // Take screenshot after clicking
    await takeScreenshot(page, 'dob-now-after-bin-click.png');

    if (formVisible) {
      console.log('\n✅ Success! BIN search form is now visible.');
    } else {
      console.log('\n⚠️  Warning: Could not verify form appearance, but click was successful.');
    }

    // Keep browser open for a moment if not headless
    if (!HEADLESS) {
      console.log('\nBrowser will stay open for 5 seconds...');
      await page.waitForTimeout(5000);
    }
  } catch (error) {
    console.error('\n❌ Error during automation:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
