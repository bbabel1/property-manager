/**
 * Global configuration for date picker components
 * 
 * This file defines the standard approach for date input across the application.
 * We use native HTML date inputs for consistency and better user experience.
 */

export const DATE_PICKER_CONFIG = {
  /**
   * Use native HTML date inputs instead of custom DatePicker components
   * This provides:
   * - Consistent browser-native date picker experience
   * - Better accessibility
   * - Simpler implementation
   * - Mobile-friendly date selection
   */
  useNativeDateInput: true,
  
  /**
   * Standard date input props for consistency
   */
  defaultProps: {
    type: 'date' as const,
    className: '', // Can be customized per use case
  },
  
  /**
   * Helper function to create standardized date input props
   */
  createDateInputProps: (value: string | null, onChange: (value: string) => void, className?: string) => ({
    type: 'date' as const,
    value: value || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    className: className || '',
  }),
} as const;

/**
 * Migration guide for developers:
 * 
 * OLD (custom DatePicker):
 * ```tsx
 * import { DatePicker } from '@/components/ui/date-picker'
 * <DatePicker value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
 * ```
 * 
 * NEW (native date input):
 * ```tsx
 * import { Input } from '@/components/ui/input'
 * <Input type="date" value={date || ''} onChange={(e) => setDate(e.target.value)} />
 * ```
 * 
 * Or use the helper:
 * ```tsx
 * import { Input } from '@/components/ui/input'
 * import { DATE_PICKER_CONFIG } from '@/lib/date-picker-config'
 * <Input {...DATE_PICKER_CONFIG.createDateInputProps(date, setDate)} />
 * ```
 */

export default DATE_PICKER_CONFIG;
