"use client";

import { format as formatDate, isValid, parse as parseDate } from "date-fns";

import { DateInput } from "./date-input";
import type { DateInputProps } from "./date-input";
import { cn } from "./utils";
import { DATE_PICKER_CONFIG } from "@/lib/date-picker-config";

export type DatePickerProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  id?: string;
  name?: string;
  clearable?: boolean;
};

const ISO_PATTERN = "yyyy-MM-dd";

const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toIsoString = (date: Date) => formatDate(normalizeDate(date), ISO_PATTERN);

const parseInput = (raw: string | null | undefined): Date | null => {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const iso = parseDate(value, ISO_PATTERN, new Date());
  if (isValid(iso)) {
    return normalizeDate(iso);
  }

  const slashFormat = parseDate(value, "MM/dd/yyyy", new Date());
  if (isValid(slashFormat)) {
    return normalizeDate(slashFormat);
  }

  const fallback = new Date(value);
  return isValid(fallback) ? normalizeDate(fallback) : null;
};

const clampDate = (date: Date, minDate?: Date, maxDate?: Date) => {
  const normalized = normalizeDate(date);
  const min = minDate ? normalizeDate(minDate) : undefined;
  const max = maxDate ? normalizeDate(maxDate) : undefined;

  if (min && normalized < min) {
    return min;
  }

  if (max && normalized > max) {
    return max;
  }

  return normalized;
};

const resolveYearRanges = (minDate?: Date, maxDate?: Date) => {
  const currentYear = new Date().getFullYear();

  const defaultPast = DATE_PICKER_CONFIG.defaultProps.pastYearRange ?? 10;
  const defaultFuture = DATE_PICKER_CONFIG.defaultProps.futureYearRange ?? 10;

  const pastYearRange =
    minDate && minDate instanceof Date
      ? Math.max(0, currentYear - minDate.getFullYear())
      : defaultPast;

  const futureYearRange =
    maxDate && maxDate instanceof Date
      ? Math.max(0, maxDate.getFullYear() - currentYear)
      : defaultFuture;

  return { pastYearRange, futureYearRange };
};

export function DatePicker({
  value,
  onChange,
  placeholder = "mm/dd/yyyy",
  disabled,
  minDate,
  maxDate,
  className,
  id,
  name,
  clearable = true,
}: DatePickerProps) {
  const normalizedValue = (() => {
    const parsed = parseInput(value);
    return parsed ? toIsoString(parsed) : "";
  })();

  const { pastYearRange, futureYearRange } = resolveYearRanges(minDate, maxDate);

  const handleChange: DateInputProps["onChange"] = (nextValue) => {
    if (!nextValue) {
      onChange(null);
      return;
    }

    const parsed = parseInput(nextValue);
    if (!parsed) {
      onChange(null);
      return;
    }

    const clamped = clampDate(parsed, minDate, maxDate);
    onChange(toIsoString(clamped));
  };

  const overrides: Partial<Omit<DateInputProps, "value" | "onChange">> = {
    id,
    name,
    placeholder,
    disabled,
    containerClassName: cn("w-full", className),
    hideClear: !clearable,
    pastYearRange,
    futureYearRange,
  };

  return (
    <DateInput
      {...DATE_PICKER_CONFIG.createDateInputProps(normalizedValue, handleChange, overrides)}
    />
  );
}

export default DatePicker;
