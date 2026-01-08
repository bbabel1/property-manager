"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type PayBillsByCheckBill = {
  id: string;
  memo: string | null;
  reference_number: string | null;
  vendor_id: string | null;
  vendor_name: string;
  property_name: string | null;
  unit_label: string | null;
  due_date: string | null;
  total_amount: number;
  remaining_amount: number;
  status?: string | null;
  isSelectable?: boolean;
  disabledReason?: string;
};

export type PayBillsByCheckVendorGroup = {
  vendorId: string | null;
  vendorLabel: string;
  hasInsuranceWarning?: boolean;
  bills: PayBillsByCheckBill[];
};

type PayBillsByCheckTableProps = {
  groups: PayBillsByCheckVendorGroup[];
};

export default function PayBillsByCheckTable({ groups }: PayBillsByCheckTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payDates, setPayDates] = useState<Record<string, string>>({});

  const allBills = useMemo(
    () => groups.flatMap((group) => group.bills),
    [groups],
  );

  const today = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  const totalSelectedAmount = useMemo(() => {
    if (!selectedIds.size) return 0;
    return allBills.reduce((sum, bill) => {
      if (!selectedIds.has(bill.id)) return sum;
      return sum + (bill.remaining_amount || 0);
    }, 0);
  }, [allBills, selectedIds]);

  const handleToggleBill = (billId: string, checked: boolean | 'indeterminate') => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(billId);
      else next.delete(billId);
      return next;
    });
  };

  const handleToggleVendor = (group: PayBillsByCheckVendorGroup, checked: boolean | 'indeterminate') => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const billIds = group.bills.map((b) => b.id);
      if (checked) {
        billIds.forEach((id) => next.add(id));
      } else {
        billIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const handlePreparePayment = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const param = encodeURIComponent(ids.join(','));
    router.push(`/accounting/pay-bills-by-check/prepare-payment?billIds=${param}`);
  };

  if (!groups.length) {
    return (
      <p className="text-muted-foreground text-sm">
        There are no unpaid bills matching your filters.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 ? (
        <div className="bg-primary/5 border-primary/30 text-primary flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs font-medium">
          <span>
            {selectedIds.size} bill{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            className="hover:text-primary/80 underline-offset-2 hover:underline"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>
        </div>
      ) : null}

      <Table className="text-sm">
        <TableHeader>
          <TableRow className="border-border border-b">
            <TableHead className="w-[2.5rem]" />
            <TableHead className="text-muted-foreground">Vendor</TableHead>
            <TableHead className="text-muted-foreground">Property</TableHead>
            <TableHead className="text-muted-foreground">Unit</TableHead>
            <TableHead className="text-muted-foreground">Due date</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground text-right">Amount</TableHead>
            <TableHead className="text-muted-foreground text-right">Remaining</TableHead>
            <TableHead className="text-muted-foreground">Pay date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group, index) => {
            const bills = Array.isArray(group.bills) ? group.bills : [];
            const enabledBills = bills.filter((b) => b.isSelectable !== false);
            const allSelected =
              enabledBills.length > 0 &&
              enabledBills.every((b) => selectedIds.has(b.id));
            const someSelected =
              !allSelected && enabledBills.some((b) => selectedIds.has(b.id));
            const groupKey = group.vendorId ?? `unknown-${index}`;
            return (
              <Fragment key={groupKey}>
                <TableRow className="border-border/60 border-t">
                  <TableCell colSpan={9} className="p-0">
                    <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Checkbox
                        aria-label={`Select bills for ${group.vendorLabel}`}
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        disabled={!enabledBills.length}
                        onCheckedChange={(checked) =>
                          enabledBills.length
                            ? handleToggleVendor(group, checked)
                            : undefined
                        }
                        className="h-3.5 w-3.5"
                      />
                      <span>{group.vendorLabel}</span>
                      {group.hasInsuranceWarning ? (
                        <Badge
                          variant="destructive"
                          className="border-destructive/40 bg-destructive/10 text-destructive"
                        >
                          MISSING
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
                {bills.map((bill) => (
                  <TableRow key={bill.id} className="border-border/40 border-t">
                    <TableCell className="align-middle">
                      {bill.isSelectable === false && bill.disabledReason ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Checkbox
                                aria-label={`Select bill ${bill.reference_number || bill.id}`}
                                checked={false}
                                disabled
                                className="translate-y-[1px]"
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{bill.disabledReason}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Checkbox
                          aria-label={`Select bill ${bill.reference_number || bill.id}`}
                          checked={selectedIds.has(bill.id)}
                          onCheckedChange={(checked) =>
                            handleToggleBill(bill.id, checked)
                          }
                          className="translate-y-[1px]"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-foreground">
                      <Link
                        href={`/bills/${bill.id}`}
                        className="text-primary hover:underline"
                      >
                        {bill.memo || bill.reference_number || 'Bill'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {bill.property_name || '—'}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {bill.unit_label || '—'}
                    </TableCell>
                    <TableCell>
                      {bill.due_date
                        ? new Date(bill.due_date).toLocaleDateString("en-US")
                        : '—'}
                    </TableCell>
                    <TableCell className="align-middle">
                      {bill.status ? (
                        <Badge
                          variant={
                            bill.status === 'Overdue'
                              ? 'destructive'
                              : bill.status === 'Paid'
                                ? 'secondary'
                                : 'outline'
                          }
                          className={cn(
                            'uppercase',
                            bill.status === 'Overdue' &&
                              'border-destructive/40 bg-destructive/10 text-destructive',
                          )}
                        >
                          {bill.status}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {bill.total_amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {bill.remaining_amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </TableCell>
                    <TableCell className="min-w-[9rem]">
                      <DateInput
                        id={`pay-date-${bill.id}`}
                        value={payDates[bill.id] ?? today}
                        onChange={(next) =>
                          setPayDates((prev) => ({
                            ...prev,
                            [bill.id]: next,
                          }))
                        }
                        openOnFocus={false}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      {selectedIds.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-foreground text-sm font-medium">
              Total payment:{' '}
              {totalSelectedAmount.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
              })}
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handlePreparePayment}
              >
                Prepare payment
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
