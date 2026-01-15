import * as React from "react";

import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentProps<"input">;

function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "bg-input-background text-primary accent-primary dark:bg-input/30 h-4 w-4 rounded-sm border border-border transition-[color,box-shadow,border-color] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "checked:bg-primary checked:border-primary checked:text-primary-foreground",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
