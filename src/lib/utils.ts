import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Minimal country mapping helper for UI forms that use Google Places
export function mapGoogleCountryToEnum(country: string): string {
  return country
}
