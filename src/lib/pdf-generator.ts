/**
 * PDF Generation Library
 *
 * Server-side PDF generation using Playwright for browser automation.
 * Converts HTML templates to professional PDF documents.
 */

import { chromium } from 'playwright';

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
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set the HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle',
    });

    // Default options
    const pdfOptions = {
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
    const pdfBuffer = await page.pdf(pdfOptions as any);

    await context.close();

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
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
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Default options
    const pdfOptions = {
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
    const pdfBuffer = await page.pdf(pdfOptions as any);

    await context.close();

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Validate PDF generation prerequisites
 *
 * Checks that required dependencies are available.
 */
export async function validatePDFGeneration(): Promise<{ isValid: boolean; error?: string }> {
  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    await browser.close();
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error ? error.message : 'Failed to initialize browser for PDF generation',
    };
  }
}
