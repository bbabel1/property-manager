"use client";

import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  useId,
  useRef,
  useCallback,
  type KeyboardEvent,
  type FocusEvent,
  type MouseEvent,
  type ComponentPropsWithoutRef,
} from "react";
import { Calendar } from "lucide-react";

import { cn } from "./utils";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Button } from "./button";

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEAR = String(CURRENT_YEAR);

const getDaysInMonth = (year: string | undefined, month: string | undefined) => {
  if (!month) {
    return 31;
  }

  const numericYear = year ? Number(year) : CURRENT_YEAR;
  const numericMonth = Number(month);

  return new Date(numericYear, numericMonth, 0).getDate();
};

const formatDisplayDate = (month: string, day: string, year: string, includeYear = true) => {
  if (!month || !day) {
    return "";
  }

  if (!includeYear) {
    return `${month}/${day}`;
  }

  if (!year) {
    return "";
  }

  return `${month}/${day}/${year}`;
};

type NativeInputProps = ComponentPropsWithoutRef<typeof Input>;

export type DateInputProps = Omit<NativeInputProps, "type" | "value" | "onChange"> & {
  value?: string;
  onChange?: (value: string) => void;
  /**
   * Number of years before the current year to include in the year dropdown.
   * Defaults to 10.
   */
  pastYearRange?: number;
  /**
   * Number of years after the current year to include in the year dropdown.
   * Defaults to 10.
   */
  futureYearRange?: number;
  containerClassName?: string;
  hideClear?: boolean;
  hideYear?: boolean;
  /**
   * Whether the picker should open on focus. Defaults to true.
   */
  openOnFocus?: boolean;
  /**
   * Whether the picker should open on click/keyboard. Defaults to true.
   */
  openOnClick?: boolean;
};

const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  {
    value,
    onChange,
    placeholder = "mm/dd/yyyy",
    pastYearRange = 10,
    futureYearRange = 10,
    disabled,
    className,
    containerClassName,
    hideClear,
    onFocus,
    onBlur,
    onClick,
    onKeyDown,
    name,
    hideYear,
    openOnFocus = true,
    openOnClick = true,
    ...inputProps
  },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false);
  const ignoreNextOpenRef = useRef(false);
  const ignoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState(DEFAULT_YEAR);

  const popoverId = useId();

  const allowNextOpen = useCallback(() => {
    if (ignoreTimerRef.current) {
      clearTimeout(ignoreTimerRef.current);
      ignoreTimerRef.current = null;
    }
    ignoreTimerRef.current = setTimeout(() => {
      ignoreNextOpenRef.current = false;
    }, 120);
  }, []);

  useEffect(
    () => () => {
      if (ignoreTimerRef.current) {
        clearTimeout(ignoreTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (value) {
      const [incomingYear = "", incomingMonth = "", incomingDay = ""] = value.split("-");
      setYear(incomingYear || DEFAULT_YEAR);
      setMonth(incomingMonth);
      setDay(incomingDay);
    } else {
      setYear(DEFAULT_YEAR);
      setMonth("");
      setDay("");
    }
  }, [value]);

  const dayOptions = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    return Array.from({ length: daysInMonth }, (_, index) =>
      String(index + 1).padStart(2, "0"),
    );
  }, [month, year]);

  const baseYearOptions = useMemo(() => {
    const pastYears = pastYearRange < 0 ? 0 : pastYearRange;
    const futureYears = futureYearRange < 0 ? 0 : futureYearRange;

    const startYear = CURRENT_YEAR + futureYears;
    const endYear = CURRENT_YEAR - pastYears;
    const years: string[] = [];

    for (let yearValue = startYear; yearValue >= endYear; yearValue -= 1) {
      years.push(String(yearValue));
    }

    return years;
  }, [pastYearRange, futureYearRange]);

  const yearOptions = useMemo(() => {
    if (!year || baseYearOptions.includes(year)) {
      return baseYearOptions;
    }

    return [year, ...baseYearOptions].sort((a, b) => Number(b) - Number(a));
  }, [baseYearOptions, year]);

  const displayValue = useMemo(
    () => formatDisplayDate(month, day, year, !hideYear),
    [day, hideYear, month, year],
  );
  const isoValue = useMemo(() => (month && day && year ? `${year}-${month}-${day}` : ""), [
    day,
    month,
    year,
  ]);

  const emitChange = (nextMonth: string, nextDay: string, nextYear: string) => {
    if (nextMonth && nextDay && nextYear) {
      ignoreNextOpenRef.current = true;
      setIsOpen(false);
      allowNextOpen();
      onChange?.(`${nextYear}-${nextMonth}-${nextDay}`);
    }
  };

  const handleMonthChange = (nextMonth: string) => {
    const maxDay = getDaysInMonth(year, nextMonth);
    let nextDay = day;

    if (nextDay) {
      const numericDay = Number(nextDay);
      if (numericDay > maxDay) {
        nextDay = String(maxDay).padStart(2, "0");
      }
    }

    setMonth(nextMonth);

    if (nextDay !== day) {
      setDay(nextDay);
    }

    emitChange(nextMonth, nextDay, year);
  };

  const handleDayChange = (nextDay: string) => {
    setDay(nextDay);
    emitChange(month, nextDay, year);
  };

  const handleYearChange = (nextYear: string) => {
    const maxDay = getDaysInMonth(nextYear, month);
    let nextDay = day;

    if (nextDay) {
      const numericDay = Number(nextDay);
      if (numericDay > maxDay) {
        nextDay = String(maxDay).padStart(2, "0");
      }
    }

    setYear(nextYear);

    if (nextDay !== day) {
      setDay(nextDay);
    }

    emitChange(month, nextDay, nextYear);
  };

  const handleClear = () => {
    setMonth("");
    setDay("");
    setYear(DEFAULT_YEAR);
    ignoreNextOpenRef.current = true;
    setIsOpen(false);
    allowNextOpen();
    onChange?.("");
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    if (!disabled && openOnFocus && !ignoreNextOpenRef.current) {
      setIsOpen(true);
    }
    onFocus?.(event);
  };

  const handleClick = (event: MouseEvent<HTMLInputElement>) => {
    if (!disabled && openOnClick && !ignoreNextOpenRef.current) {
      setIsOpen(true);
    }
    onClick?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      !disabled &&
      openOnClick &&
      !ignoreNextOpenRef.current &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      setIsOpen(true);
    }
    onKeyDown?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
  };

  const gridColumnsClass = hideYear ? "grid-cols-2" : "grid-cols-3";

  const handleSetToday = () => {
    const today = new Date();
    const nextMonth = String(today.getMonth() + 1).padStart(2, "0");
    const nextDay = String(today.getDate()).padStart(2, "0");
    const nextYear = String(today.getFullYear());

    setMonth(nextMonth);
    setDay(nextDay);
    setYear(nextYear);
    emitChange(nextMonth, nextDay, nextYear);
  };

  return (
    <div className={cn("relative", containerClassName)}>
      <Calendar className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      {name ? <input type="hidden" name={name} value={isoValue} /> : null}
      <Popover open={isOpen} onOpenChange={(next) => !disabled && setIsOpen(next)}>
        <PopoverTrigger asChild>
          <Input
            ref={ref}
            type="text"
            readOnly
            disabled={disabled}
            value={displayValue}
            placeholder={placeholder}
            className={cn("pl-9 cursor-pointer", className)}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            aria-controls={popoverId}
            onFocus={handleFocus}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            {...inputProps}
          />
        </PopoverTrigger>
        <PopoverContent id={popoverId} align="start" className="w-[280px] space-y-3">
          <div className={cn("grid gap-2", gridColumnsClass)}>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Month</span>
              <Select value={month} onValueChange={handleMonthChange} disabled={disabled}>
                <SelectTrigger id={`${inputProps?.id || ""}-month`}>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Day</span>
              <Select value={day} onValueChange={handleDayChange} disabled={disabled}>
                <SelectTrigger id={`${inputProps?.id || ""}-day`}>
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {Number(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hideYear ? null : (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Year</span>
                <Select value={year} onValueChange={handleYearChange} disabled={disabled}>
                  <SelectTrigger id={`${inputProps?.id || ""}-year`}>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {yearOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSetToday}
              disabled={disabled}
            >
              Today
            </Button>
            {hideClear ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
              >
                Clear
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

DateInput.displayName = "DateInput";

export { DateInput };
