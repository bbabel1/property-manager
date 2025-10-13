"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "./utils";
import { TableRow } from "./table";

type TableRowLinkProps = React.ComponentProps<typeof TableRow> & {
  href: string;
  openInNewTabOnMetaKey?: boolean;
};

export function TableRowLink({
  href,
  className,
  children,
  onClick,
  onKeyDown,
  openInNewTabOnMetaKey = true,
  ...rest
}: TableRowLinkProps) {
  const router = useRouter();

  const handleNavigation = React.useCallback(
    () => {
      router.push(href);
    },
    [router, href],
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;

      if (openInNewTabOnMetaKey && (event.metaKey || event.ctrlKey)) {
        window.open(href, "_blank", "noopener");
        return;
      }

      handleNavigation();
    },
    [onClick, openInNewTabOnMetaKey, href, handleNavigation],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNavigation();
      }
    },
    [onKeyDown, handleNavigation],
  );

  return (
    <TableRow
      role="link"
      tabIndex={0}
      className={cn(
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </TableRow>
  );
}

export default TableRowLink;
