"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({
  toastOptions,
  className,
  closeButton,
  position,
  richColors,
  style: customStyle,
  ...props
}: ToasterProps) => {
  const { theme } = useTheme();
  const style = {
    "--normal-bg": "#071911",
    "--normal-bg-hover": "#0a2218",
    "--normal-text": "#d7ffe9",
    "--normal-border": "#0f2f21",
    "--normal-border-hover": "#174230",
    "--success-bg": "#071911",
    "--success-border": "#11412d",
    "--success-text": "#72f0b3",
    "--info-bg": "#0a1c28",
    "--info-border": "#123145",
    "--info-text": "#a9d9ff",
    "--warning-bg": "#2a1d06",
    "--warning-border": "#3d2a0a",
    "--warning-text": "#ffd386",
    "--error-bg": "#2a0e14",
    "--error-border": "#4b1823",
    "--error-text": "#ffc2cf",
    "--border-radius": "12px",
    ...customStyle,
  } as React.CSSProperties;
  const themeValue = (theme ?? "system") as ToasterProps["theme"];
  const incomingClassNames = toastOptions?.classNames ?? {};
  const mergedClassName = ["toaster", "app-toaster", "group", className]
    .filter(Boolean)
    .join(" ");
  const mergedToastOptions: ToasterProps["toastOptions"] = {
    duration: 4000,
    ...(toastOptions ?? {}),
    classNames: {
      ...incomingClassNames,
      toast: ["app-toast", incomingClassNames.toast].filter(Boolean).join(" "),
      title: ["app-toast__title", incomingClassNames.title].filter(Boolean).join(" "),
      description: ["app-toast__description", incomingClassNames.description]
        .filter(Boolean)
        .join(" "),
      icon: ["app-toast__icon", incomingClassNames.icon].filter(Boolean).join(" "),
      closeButton: ["app-toast__close", incomingClassNames.closeButton]
        .filter(Boolean)
        .join(" "),
      actionButton: incomingClassNames.actionButton,
      cancelButton: incomingClassNames.cancelButton,
    },
  };

  return (
    <Sonner
      theme={themeValue}
      className={mergedClassName}
      style={style}
      position={position ?? "top-right"}
      richColors={richColors ?? true}
      closeButton={closeButton ?? true}
      toastOptions={mergedToastOptions}
      {...props}
    />
  );
};

export { Toaster };
export default Toaster;
