# Browser Automation Tests

This directory contains browser automation scripts using Playwright.

## Prerequisites

Playwright is already installed as a dependency. However, you need to install the browser binaries:

```bash
# Install all browsers (Chromium, Firefox, WebKit)
npx playwright install

# Or install only Chromium (recommended for this script)
npx playwright install chromium
```

## Scripts

### `dob-now-bin-search.ts`

Automates navigation to the DOB NOW Public Portal and clicking the BIN search card.

**Usage:**

```bash
# Basic usage (headless mode)
npx tsx scripts/tests/dob-now-bin-search.ts

# Run in headed mode (see the browser)
HEADLESS=false npx tsx scripts/tests/dob-now-bin-search.ts

# Add delay between actions (useful for debugging)
SLOW_MO=500 npx tsx scripts/tests/dob-now-bin-search.ts

# Custom URL
DOB_NOW_URL=https://custom-url.com npx tsx scripts/tests/dob-now-bin-search.ts
```

**Environment Variables:**

- `DOB_NOW_URL` - Override the default DOB NOW portal URL (default: `https://a810-dobnow.nyc.gov/publish/Index.html#!/`)
- `HEADLESS` - Set to `false` to run in headed mode (default: `true`)
- `SLOW_MO` - Add delay between actions in milliseconds (default: `0`)

**What it does:**

1. Launches a Chromium browser
2. Navigates to the DOB NOW Public Portal
3. Takes a screenshot (`dob-now-initial.png`)
4. Clicks on the "Search by BIN" card
5. Verifies the BIN search form appears
6. Takes another screenshot (`dob-now-after-bin-click.png`)
7. Closes the browser

**Screenshots:**

The script saves screenshots in the project root:
- `dob-now-initial.png` - Before clicking the BIN card
- `dob-now-after-bin-click.png` - After clicking the BIN card

## How It Works

The script uses Playwright's programmatic API (not the test runner) to:

1. **Launch Browser**: Creates a Chromium browser instance
2. **Navigate**: Goes to the DOB NOW portal URL
3. **Element Selection**: Uses multiple strategies to find the BIN card:
   - Image with name "Search by BIN"
   - Button with accessible name
   - Role-based selection
4. **Interaction**: Clicks the element and waits for the form
5. **Verification**: Checks that the BIN input field appears

## Troubleshooting

**Browser not found:**
```bash
npx playwright install chromium
```

**Element not found:**
- The page structure may have changed
- Try running in headed mode (`HEADLESS=false`) to see what's happening
- Check the screenshots to see the current page state

**Timeout errors:**
- The page may be loading slowly
- Increase timeouts in the script if needed
- Check your network connection

## Adding New Scripts

When creating new browser automation scripts:

1. Use the same pattern as `dob-now-bin-search.ts`
2. Include proper error handling
3. Add screenshots for debugging
4. Document environment variables
5. Follow the project's TypeScript conventions

