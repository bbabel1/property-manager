"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();
  const style = {
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
  } as React.CSSProperties;
  const themeValue = (theme ?? "system") as ToasterProps["theme"];

  return (
    <Sonner
      theme={themeValue}
      className="toaster group"
      style={style}
      {...props}
    />
  );
};

export { Toaster };
export default Toaster;
