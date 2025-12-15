/**
 * Email Template Formatting Helpers
 *
 * Canonical formatting functions for template variables.
 * Centralized formatting ensures consistency across all templates.
 */

import type { VariableFormat } from './variable-definitions';

/**
 * Format a value as currency
 *
 * @param value - Numeric value to format
 * @param locale - Locale string (default: 'en-US')
 * @param currency - Currency code (default: 'USD')
 * @param nullDefault - Default value if null/undefined (default: '')
 * @returns Formatted currency string or nullDefault
 */
export function formatCurrency(
  value: unknown,
  locale: string = 'en-US',
  currency: string = 'USD',
  nullDefault: string = '',
): string {
  if (value === null || value === undefined) {
    return nullDefault;
  }

  const numValue = typeof value === 'number' ? value : Number(value);

  if (isNaN(numValue)) {
    return nullDefault;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(numValue);
  } catch {
    console.error('Error formatting currency');
    return nullDefault;
  }
}

/**
 * Format a value as a date
 *
 * @param value - Date value (string, Date, or number)
 * @param format - Format type: 'short', 'long', 'iso', 'month-year' (default: 'short')
 * @param timezone - Timezone string (optional)
 * @param nullDefault - Default value if null/undefined (default: '')
 * @returns Formatted date string or nullDefault
 */
export function formatDate(
  value: unknown,
  format: 'short' | 'long' | 'iso' | 'month-year' = 'short',
  timezone?: string,
  nullDefault: string = '',
): string {
  if (value === null || value === undefined) {
    return nullDefault;
  }

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    return nullDefault;
  }

  if (isNaN(date.getTime())) {
    return nullDefault;
  }

  try {
    switch (format) {
      case 'short':
        return new Intl.DateTimeFormat('en-US', {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric',
          timeZone: timezone,
        }).format(date);
      case 'long':
        return new Intl.DateTimeFormat('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: timezone,
        }).format(date);
      case 'iso':
        return date.toISOString();
      case 'month-year':
        return new Intl.DateTimeFormat('en-US', {
          month: 'long',
          year: 'numeric',
          timeZone: timezone,
        }).format(date);
      default:
        return date.toLocaleDateString();
    }
  } catch {
    return nullDefault;
  }
}

/**
 * Format a value as a number
 *
 * @param value - Numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @param nullDefault - Default value if null/undefined (default: '')
 * @returns Formatted number string or nullDefault
 */
export function formatNumber(
  value: unknown,
  decimals: number = 2,
  nullDefault: string = '',
): string {
  if (value === null || value === undefined) {
    return nullDefault;
  }

  const numValue = typeof value === 'number' ? value : Number(value);

  if (isNaN(numValue)) {
    return nullDefault;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numValue);
  } catch (error) {
    console.error('Error formatting number:', error);
    return nullDefault;
  }
}

/**
 * Format a value as a percentage
 *
 * @param value - Numeric value to format (e.g., 12.5 for 12.5%)
 * @param decimals - Number of decimal places (default: 1)
 * @param nullDefault - Default value if null/undefined (default: '')
 * @returns Formatted percentage string or nullDefault
 */
export function formatPercent(
  value: unknown,
  decimals: number = 1,
  nullDefault: string = '',
): string {
  if (value === null || value === undefined) {
    return nullDefault;
  }

  const numValue = typeof value === 'number' ? value : Number(value);

  if (isNaN(numValue)) {
    return nullDefault;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numValue / 100);
  } catch (error) {
    console.error('Error formatting percent:', error);
    return nullDefault;
  }
}

/**
 * Format a value as a URL
 *
 * @param value - URL string to format/validate
 * @param nullDefault - Default value if null/undefined/invalid (default: '')
 * @returns Validated URL string or nullDefault
 */
export function formatUrl(value: unknown, nullDefault: string = ''): string {
  if (value === null || value === undefined) {
    return nullDefault;
  }

  const urlString = String(value).trim();

  if (!urlString) {
    return nullDefault;
  }

  // Basic URL validation
  try {
    const url = new URL(urlString);
    return url.toString();
  } catch {
    // If URL parsing fails, try adding https:// prefix
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      try {
        const url = new URL(`https://${urlString}`);
        return url.toString();
      } catch {
        return nullDefault;
      }
    }
    return nullDefault;
  }
}

/**
 * Format a template variable value based on its format type
 *
 * @param value - Value to format
 * @param format - Format type
 * @param nullDefault - Default value if null/undefined (default: '')
 * @returns Formatted value string
 */
export function formatTemplateVariable(
  value: unknown,
  format: VariableFormat,
  nullDefault: string = '',
): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value, 'en-US', 'USD', nullDefault);
    case 'date':
      return formatDate(value, 'short', undefined, nullDefault);
    case 'number':
      return formatNumber(value, 2, nullDefault);
    case 'percent':
      return formatPercent(value, 1, nullDefault);
    case 'url':
      return formatUrl(value, nullDefault);
    case 'string':
    default:
      if (value === null || value === undefined) {
        return nullDefault;
      }
      return String(value);
  }
}
