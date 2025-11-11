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

  const isIgnoredEvent = React.useCallback((event: { composedPath?: () => EventTarget[]; target: EventTarget | null }) => {
    const ignoreRole = (node: HTMLElement) => {
      const role = node.getAttribute?.("role");
      return role === "dialog" || role === "alertdialog" || role === "menu" || role === "menuitem";
    };

    const path = typeof event.composedPath === "function" ? event.composedPath() : undefined;
    if (path && path.length) {
      return path.some(
        (node) =>
          node instanceof HTMLElement &&
          (node.dataset?.rowLinkIgnore === "true" || ignoreRole(node)),
      );
    }

    let current: EventTarget | null | undefined = event.target;
    while (current && current instanceof HTMLElement) {
      if (current.dataset?.rowLinkIgnore === "true" || ignoreRole(current)) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }, []);

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
      if (isIgnoredEvent(event)) return;

      if (openInNewTabOnMetaKey && (event.metaKey || event.ctrlKey)) {
        window.open(href, "_blank", "noopener");
        return;
      }

      handleNavigation();
    },
    [onClick, openInNewTabOnMetaKey, href, handleNavigation, isIgnoredEvent],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (isIgnoredEvent(event)) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNavigation();
      }
    },
    [onKeyDown, handleNavigation, isIgnoredEvent],
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
