"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import BillsFilters from "@/components/financials/BillsFilters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Option = { id: string; label: string; internalId?: string };

type SimpleOption = { id: string; label: string };

type PayBillsByCheckFiltersProps = {
  defaultPropertyIds: string[];
  defaultUnitIds: string[];
  defaultVendorIds: string[];
  defaultStatuses: string[];
  propertyOptions: Option[];
  unitOptions: SimpleOption[];
  vendorOptions: SimpleOption[];
  defaultInclude: string;
  defaultAllocation: "automatic" | "manual";
  defaultConsolidation: "yes" | "no";
};

export default function PayBillsByCheckFilters({
  defaultPropertyIds,
  defaultUnitIds,
  defaultVendorIds,
  defaultStatuses,
  propertyOptions,
  unitOptions,
  vendorOptions,
  defaultInclude,
  defaultAllocation,
  defaultConsolidation,
}: PayBillsByCheckFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const include = searchParams?.get("include") || defaultInclude;
  const allocation = (searchParams?.get("allocation") as "automatic" | "manual" | null) || defaultAllocation;
  const consolidation =
    (searchParams?.get("consolidation") as "yes" | "no" | null) || defaultConsolidation;

  const updateSearch = useMemo(
    () =>
      (mutator: (p: URLSearchParams) => void) => {
        const base = searchParams ? searchParams.toString() : "";
        const params = new URLSearchParams(base);
        mutator(params);
        const q = params.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-4">
      <BillsFilters
        defaultPropertyIds={defaultPropertyIds}
        defaultUnitIds={defaultUnitIds}
        defaultVendorIds={defaultVendorIds}
        defaultStatuses={defaultStatuses}
        propertyOptions={propertyOptions}
        unitOptions={unitOptions}
        vendorOptions={vendorOptions}
        showPropertyFilter
        showUnitFilter={false}
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[16rem] flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Include
          </span>
          <Select
            value={include}
            onValueChange={(value) =>
              updateSearch((p) => {
                if (!value || value === "all") p.delete("include");
                else p.set("include", value);
              })
            }
          >
            <SelectTrigger size="sm" className="min-w-[16rem]">
              <SelectValue placeholder="Select items to include…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              <SelectItem value="with-balance">With remaining balance only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Allocation method
          </span>
          <RadioGroup
            className="flex flex-row items-center gap-4"
            value={allocation}
            onValueChange={(value) =>
              updateSearch((p) => {
                if (!value || value === "automatic") p.delete("allocation");
                else p.set("allocation", value);
              })
            }
          >
            <label className="flex items-center gap-2 text-xs text-foreground">
              <RadioGroupItem value="automatic" />
              <span>Automatic</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <RadioGroupItem value="manual" />
              <span>Manual</span>
            </label>
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payment consolidation
          </span>
          <RadioGroup
            className="flex flex-row items-center gap-4"
            value={consolidation}
            onValueChange={(value) =>
              updateSearch((p) => {
                if (!value || value === "yes") p.delete("consolidation");
                else p.set("consolidation", value);
              })
            }
          >
            <label className="flex items-center gap-2 text-xs text-foreground">
              <RadioGroupItem value="yes" />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <RadioGroupItem value="no" />
              <span>No</span>
            </label>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
