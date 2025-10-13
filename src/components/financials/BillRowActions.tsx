"use client";

import ActionButton from "@/components/ui/ActionButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as React from "react";

export function BillRowActions() {
  const stopPropagation = React.useCallback(
    (event: React.SyntheticEvent) => {
      event.stopPropagation();
    },
    [],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton
          aria-label="Bill actions"
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]" side="bottom" sideOffset={6}>
        <DropdownMenuItem className="cursor-pointer" onSelect={(event) => event.preventDefault()}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onSelect={(event) => event.preventDefault()}>
          Email
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onSelect={(event) => event.preventDefault()}>
          Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default BillRowActions;
