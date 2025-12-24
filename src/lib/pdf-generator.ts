/**
 * PDF Generation Library
 *
 * Server-side PDF generation using Playwright for browser automation.
 * Converts HTML templates to professional PDF documents.
 */

import { existsSync } from 'node:fs';

import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { Page } from 'playwright-core';

const DEFAULT_LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'] as const;

const PLATFORM_BROWSER_CANDIDATES: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ],
};

type PagePdfOptions = Parameters<Page['pdf']>[0];

/**
 * Resolve a Chromium executable path that exists on the host.
 *
 * Preference order:
 * 1) Explicit env override (PLAYWRIGHT_CHROMIUM_PATH, CHROMIUM_EXECUTABLE_PATH, CHROMIUM_PATH, GOOGLE_CHROME_SHIM)
 * 2) Playwright-managed browser path (if downloaded)
 * 3) Common system Chrome/Chromium locations by platform
 */
function getChromiumExecutablePath(): string | undefined {
  const playwrightExecutable =
    typeof chromium.executablePath === 'function' ? chromium.executablePath() : undefined;

  const candidatePaths = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    process.env.CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    process.env.GOOGLE_CHROME_SHIM,
    playwrightExecutable,
    ...(PLATFORM_BROWSER_CANDIDATES[process.platform] ?? []),
  ].filter(Boolean) as string[];

  return candidatePaths.find((candidate) => existsSync(candidate));
}

let sharedBrowserPromise: Promise<Browser> | null = null;
const globalPdfFlags = globalThis as typeof globalThis & {
  __pdfShutdownHookRegistered?: boolean;
};
let activeBrowserUsers = 0;
let browserIdleTimer: NodeJS.Timeout | null = null;

const BROWSER_IDLE_TTL_MS = 5_000;

async function launchChromiumBrowser() {
  const executablePath = getChromiumExecutablePath();

  if (!executablePath) {
    throw new Error(
      'Chromium is not available for PDF generation. Install Playwright browsers with `npx playwright install chromium` or set PLAYWRIGHT_CHROMIUM_PATH to an installed Chrome/Chromium binary.',
    );
  }

  try {
    return await chromium.launch({
      headless: true,
      args: [...DEFAULT_LAUNCH_ARGS],
      executablePath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown launch error';
    throw new Error(
      `Failed to launch Chromium for PDF generation using ${executablePath}. ${message}`,
    );
  }
}

function registerBrowserShutdownHook() {
  if (globalPdfFlags.__pdfShutdownHookRegistered) return;
  globalPdfFlags.__pdfShutdownHookRegistered = true;

  const shutdown = async () => {
    await closeSharedBrowser();
  };

  ['beforeExit', 'SIGINT', 'SIGTERM'].forEach((event) => {
    process.once(event as NodeJS.Signals | 'beforeExit', shutdown);
  });
}

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchChromiumBrowser();
    sharedBrowserPromise.catch(() => {
      sharedBrowserPromise = null;
    });
    registerBrowserShutdownHook();
  }

  const browser = await sharedBrowserPromise;
  if (!browser.isConnected()) {
    sharedBrowserPromise = null;
    return getSharedBrowser();
  }

  return browser;
}

function markBrowserActive() {
  activeBrowserUsers += 1;
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
    browserIdleTimer = null;
  }
}

async function closeSharedBrowser() {
  if (!sharedBrowserPromise) return;
  try {
    const browser = await sharedBrowserPromise;
    if (browser?.isConnected()) {
      await browser.close();
    }
  } catch {
    // best effort; nothing else to do
  } finally {
    sharedBrowserPromise = null;
  }
}

function releaseBrowserAfterUse() {
  activeBrowserUsers = Math.max(0, activeBrowserUsers - 1);
  if (activeBrowserUsers > 0 || browserIdleTimer) return;

  browserIdleTimer = setTimeout(() => {
    void closeSharedBrowser();
  }, BROWSER_IDLE_TTL_MS);

  // Allow process to exit naturally without waiting for the idle timer.
  browserIdleTimer.unref?.();
}

export interface PDFGenerationOptions {
  /**
   * Page format (default: 'Letter')
   */
  format?: 'Letter' | 'Legal' | 'A4';

  /**
   * Page margins in inches
   */
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };

  /**
   * Display header and footer
   */
  displayHeaderFooter?: boolean;

  /**
   * Header template (HTML)
   */
  headerTemplate?: string;

  /**
   * Footer template (HTML)
   */
  footerTemplate?: string;

  /**
   * Print background graphics
   */
  printBackground?: boolean;

  /**
   * Prefer CSS page size
   */
  preferCSSPageSize?: boolean;
}

/**
 * Generate a PDF from HTML string
 *
 * @param html - HTML string to convert to PDF
 * @param options - PDF generation options
 * @returns Buffer containing the PDF data
 */
export async function generatePDFFromHTML(
  html: string,
  options: PDFGenerationOptions = {},
): Promise<Buffer> {
  markBrowserActive();
  const browser = await getSharedBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext();
    const page = await context.newPage();

    // Set the HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle',
    });

    // Default options
    const pdfOptions: PagePdfOptions = {
      format: options.format || 'Letter',
      margin: options.margin || {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      printBackground: options.printBackground ?? true,
      preferCSSPageSize: options.preferCSSPageSize ?? true,
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
    };

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    await context.close();

    return Buffer.from(pdfBuffer);
  } finally {
    await context?.close();
    releaseBrowserAfterUse();
  }
}

/**
 * Generate a PDF from a URL
 *
 * Useful for rendering server-side pages directly to PDF.
 *
 * @param url - URL to convert to PDF
 * @param options - PDF generation options
 * @returns Buffer containing the PDF data
 */
export async function generatePDFFromURL(
  url: string,
  options: PDFGenerationOptions = {},
): Promise<Buffer> {
  markBrowserActive();
  const browser = await getSharedBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Default options
    const pdfOptions: PagePdfOptions = {
      format: options.format || 'Letter',
      margin: options.margin || {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      printBackground: options.printBackground ?? true,
      preferCSSPageSize: options.preferCSSPageSize ?? true,
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
    };

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    await context.close();

    return Buffer.from(pdfBuffer);
  } finally {
    await context?.close();
    releaseBrowserAfterUse();
  }
}

/**
 * Validate PDF generation prerequisites
 *
 * Checks that required dependencies are available.
 */
export async function validatePDFGeneration(): Promise<{ isValid: boolean; error?: string }> {
  try {
    markBrowserActive();
    const browser = await getSharedBrowser();
    let context: BrowserContext | null = null;
    try {
      context = await browser.newContext();
      await context.close();
    } finally {
      await context?.close();
      releaseBrowserAfterUse();
    }
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error ? error.message : 'Failed to initialize browser for PDF generation',
    };
  }
}
