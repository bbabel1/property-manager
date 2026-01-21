import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariantStyles = {
  default:
    "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
  success:
    "border-green-500 bg-green-50 text-green-700",
  warning:
    "border-amber-600 bg-amber-50 text-amber-700",
  danger:
    "border-red-700 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  destructive:
    "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
  outline:
    "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
} as const;

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: badgeVariantStyles,
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeVariant = 
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "destructive"
  | "outline";

type BadgeProps = React.ComponentProps<"span"> & {
  variant?: BadgeVariant;
  asChild?: boolean;
};

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps, BadgeVariant };
