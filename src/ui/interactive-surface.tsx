import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type InteractiveSurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  asChild?: boolean;
};

const interactiveSurfaceBaseClasses =
  "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-[color,background-color,border-color,box-shadow]";

const InteractiveSurface = React.forwardRef<HTMLDivElement, InteractiveSurfaceProps>(
  ({ asChild = false, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        data-slot="interactive-surface"
        className={cn(interactiveSurfaceBaseClasses, className)}
        ref={ref}
        {...props}
      />
    );
  },
);

InteractiveSurface.displayName = "InteractiveSurface";

export { InteractiveSurface, interactiveSurfaceBaseClasses };

