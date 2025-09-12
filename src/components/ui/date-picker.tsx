"use client";

import * as React from "react";
import { format as fmt, parse as parseDate, isValid } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { cn } from "./utils";
import { Input } from "./input";
import { Button } from "./button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";

type Props = {
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

function toISO(d: Date) {
  return fmt(d, "yyyy-MM-dd");
}

function parseInput(text: string): Date | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // Try ISO first, then common US format
  const a = parseDate(trimmed, "yyyy-MM-dd", new Date());
  if (isValid(a)) return a;
  const b = parseDate(trimmed, "MM/dd/yyyy", new Date());
  if (isValid(b)) return b;
  const c = new Date(trimmed);
  return isValid(c) ? c : null;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "YYYY-MM-DD",
  disabled,
  minDate,
  maxDate,
  className,
  id,
  name,
  clearable = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string>(value || "");

  React.useEffect(() => {
    setText(value || "");
  }, [value]);

  const selected = React.useMemo(() => (value ? parseInput(value) : undefined), [value]);

  function commitText(next: string) {
    setText(next);
    const parsed = parseInput(next);
    if (parsed) {
      onChange(toISO(parsed));
    } else if (!next) {
      onChange(null);
    }
  }

  function onSelect(d?: Date) {
    if (!d) return;
    onChange(toISO(d));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverAnchor asChild>
          <Input
            id={id}
            name={name}
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commitText(e.target.value)}
            disabled={disabled}
            className={cn("pr-20")}
            inputMode="numeric"
            autoComplete="off"
          />
        </PopoverAnchor>
        <div className="absolute inset-y-0 right-1 flex items-center gap-1">
          {clearable && (value ?? text) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => {
                setText("");
                onChange(null);
              }}
              disabled={disabled}
              aria-label="Clear date"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              disabled={disabled}
              aria-label="Open calendar"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </div>
      </div>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={onSelect}
          initialFocus
          disabled={(date) => {
            if (minDate) {
              const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
              if (date < min) return true;
            }
            if (maxDate) {
              const max = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59, 999);
              if (date > max) return true;
            }
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default DatePicker;
