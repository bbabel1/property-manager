"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

type IconProps = React.ComponentPropsWithoutRef<"svg">;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "w-[268px] rounded-xl border border-border bg-background text-foreground shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)]",
        className,
      )}
      classNames={{
        months: "space-y-2",
        month: "space-y-3 px-3 pb-3",
        caption: "flex items-center justify-between text-sm font-semibold text-foreground",
        caption_label: "text-sm font-semibold",
        nav: "flex items-center gap-2",
        nav_button:
          "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        nav_button_previous: "order-first",
        nav_button_next: "order-last",
        table: "w-full border-collapse",
        head_row: "grid grid-cols-7 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
        head_cell: "flex h-8 items-center justify-center",
        row: "grid grid-cols-7 text-sm",
        cell: cn(
          "relative flex h-9 w-9 items-center justify-center",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-full [&:has(>.day-range-start)]:rounded-l-full"
            : undefined,
        ),
        day: "inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "text-primary font-semibold",
        day_outside:
          "day-outside text-muted-foreground/60 aria-selected:text-muted-foreground/60",
        day_disabled: "text-muted-foreground/50 opacity-50",
        day_range_middle:
          "aria-selected:bg-primary/10 aria-selected:text-foreground",
        day_hidden: "invisible",
        footer: "border-t border-border/70 px-3 pb-2 pt-2 text-sm",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...iconProps }: IconProps) => (
          <ChevronLeft className={cn("size-4", className)} {...iconProps} />
        ),
        IconRight: ({ className, ...iconProps }: IconProps) => (
          <ChevronRight className={cn("size-4", className)} {...iconProps} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
