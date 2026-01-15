import * as React from "react";

import { cn } from "@/lib/utils";

type HeadingSize = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type PolymorphicProps<C extends React.ElementType, Props = object> = Props &
  Omit<React.ComponentPropsWithoutRef<C>, "as"> & {
    as?: C;
  };

type PolymorphicRef<C extends React.ElementType> = React.ComponentPropsWithRef<C>["ref"];

type HeadingProps<C extends React.ElementType = "h2"> = PolymorphicProps<
  C,
  {
    size?: HeadingSize;
  }
>;

const headingSizes: Record<HeadingSize, string> = {
  h1: "text-4xl",
  h2: "text-3xl",
  h3: "text-2xl",
  h4: "text-xl",
  h5: "text-lg",
  h6: "text-base",
};

type HeadingComponent = <C extends React.ElementType = "h2">(
  props: HeadingProps<C> & { ref?: PolymorphicRef<C> },
) => React.ReactElement | null;

const HeadingBase = <C extends React.ElementType = "h2">(
  { as, size = "h2", className, ...props }: HeadingProps<C>,
  ref: PolymorphicRef<C>,
) => {
  const Component = (as ?? size) as React.ElementType;
  return (
    <Component
      ref={ref}
      className={cn(
        "text-foreground font-semibold leading-tight tracking-tight",
        headingSizes[size],
        className,
      )}
      {...props}
    />
  );
};

const Heading = React.forwardRef(HeadingBase as unknown as any) as unknown as HeadingComponent;

type BodySize = "xs" | "sm" | "md" | "lg";

type BodyProps<C extends React.ElementType = "p"> = PolymorphicProps<
  C,
  {
    size?: BodySize;
    tone?: "default" | "muted";
  }
>;

const bodySizes: Record<BodySize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

type BodyComponent = <C extends React.ElementType = "p">(
  props: BodyProps<C> & { ref?: PolymorphicRef<C> },
) => React.ReactElement | null;

const BodyBase = <C extends React.ElementType = "p">(
  { as, size = "md", tone = "default", className, ...props }: BodyProps<C>,
  ref: PolymorphicRef<C>,
) => {
  const Component = (as ?? "p") as React.ElementType;
  return (
    <Component
      ref={ref}
      className={cn(
        "leading-relaxed",
        bodySizes[size],
        tone === "muted" ? "text-muted-foreground" : "text-foreground",
        className,
      )}
      {...props}
    />
  );
};

const Body = React.forwardRef(BodyBase as unknown as any) as unknown as BodyComponent;

type LabelSize = "sm" | "xs";

type LabelProps<C extends React.ElementType = "label"> = PolymorphicProps<
  C,
  {
    size?: LabelSize;
    tone?: "default" | "muted";
  }
>;

const labelSizes: Record<LabelSize, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

type LabelComponent = <C extends React.ElementType = "label">(
  props: LabelProps<C> & { ref?: PolymorphicRef<C> },
) => React.ReactElement | null;

const LabelBase = <C extends React.ElementType = "label">(
  { as, size = "sm", tone = "default", className, ...props }: LabelProps<C>,
  ref: PolymorphicRef<C>,
) => {
  const Component = (as ?? "label") as React.ElementType;
  return (
    <Component
      ref={ref}
      className={cn(
        "font-medium leading-tight",
        labelSizes[size],
        tone === "muted" ? "text-muted-foreground" : "text-foreground",
        className,
      )}
      {...props}
    />
  );
};

const Label = React.forwardRef(LabelBase as unknown as any) as unknown as LabelComponent;

export { Body, Heading, Label };
export type { BodySize, HeadingSize, LabelSize };
