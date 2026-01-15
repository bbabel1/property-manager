"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import type { LabelSize } from "@/ui/typography";
import { cn } from "./utils";

const labelSizes: Record<LabelSize, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

function Label({
  className,
  size = "sm",
  tone = "default",
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
  size?: LabelSize;
  tone?: "default" | "muted";
}) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 leading-tight font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        labelSizes[size],
        tone === "muted" ? "text-muted-foreground" : "text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
