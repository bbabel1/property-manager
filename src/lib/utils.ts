import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Minimal country mapping helper for UI forms that use Google Places
export function mapGoogleCountryToEnum(country: string): string {
  if (!country) return 'United States'
  const raw = country.trim()
  const lower = raw.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ')
  // Common abbreviations and variants
  if (['us', 'u s', 'usa', 'u s a', 'united states', 'united states of america', 'unitedstates', 'u.s.', 'u. s.'].includes(lower)) {
    return 'United States'
  }
  if (['uk', 'u k', 'united kingdom', 'great britain'].includes(lower)) {
    return 'United Kingdom'
  }
  if (['uae', 'u a e', 'united arab emirates'].includes(lower)) {
    return 'United Arab Emirates'
  }
  if (['czech republic', 'czechia'].includes(lower)) {
    return 'Czech Republic (Czechia)'
  }
  if (['ivory coast', "cote d ivoire", 'cote divoire'].includes(lower)) {
    return "Ivory Coast (Côte d'Ivoire)"
  }
  if (lower === 'north korea') return 'Korea (North Korea)'
  if (lower === 'south korea') return 'Korea (South Korea)'
  if (lower === 'macedonia') return 'North Macedonia'
  if (lower === 'burma') return 'Myanmar (Burma)'
  if (['sao tome and principe', 'sao tome & principe'].includes(lower)) return 'São Tomé and Príncipe'
  if (lower === 'vatican city') return 'Vatican City (Holy See)'
  if (['st kitts and nevis', 'st. kitts and nevis', 'saint kitts and nevis'].includes(lower)) return 'Saint Kitts and Nevis'
  if (['st lucia', 'st. lucia', 'saint lucia'].includes(lower)) return 'Saint Lucia'
  if (['st vincent and the grenadines', 'st. vincent and the grenadines', 'saint vincent and the grenadines'].includes(lower)) return 'Saint Vincent and the Grenadines'
  // Default: trust the provider; many providers already return full country names
  // Caller should ensure the final result is within the enum domain; if not, server will reject
  return raw
}
