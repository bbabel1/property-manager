"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/ui/checkbox";
import { Body, Heading } from "@/ui/typography";

export type PreparePaymentBill = {
  id: string;
  vendorName: string;
  propertyName: string | null;
  remainingAmount: number;
  bankGlAccountId: string | null;
};

export type PreparePaymentGroup = {
  bankGlAccountId: string | null;
  bankLabel: string;
  bills: PreparePaymentBill[];
};

type PreparePaymentFormProps = {
  totalAmount: number;
  groups: PreparePaymentGroup[];
};

type BillFormState = {
  payDate: string;
  amount: string;
  memo: string;
  checkNumber: string;
};

type GroupFormState = {
  queueForPrinting: boolean;
};

type PaymentResult = {
  billId: string;
  success: boolean;
  error?: string | null;
};

export default function PreparePaymentForm({
  totalAmount,
  groups,
}: PreparePaymentFormProps) {
  const router = useRouter();
  const today = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );

  const [billState, setBillState] = useState<Record<string, BillFormState>>(() => {
    const initial: Record<string, BillFormState> = {};
    for (const group of groups) {
      for (const bill of group.bills) {
        initial[bill.id] = {
          payDate: today,
          amount: bill.remainingAmount.toFixed(2),
          memo: bill.propertyName || "",
          checkNumber: "",
        };
      }
    }
    return initial;
  });

  const [groupState, setGroupState] = useState<Record<string, GroupFormState>>(() => {
    const initial: Record<string, GroupFormState> = {};
    for (const group of groups) {
      const key = group.bankGlAccountId ?? "none";
      initial[key] = { queueForPrinting: false };
    }
    return initial;
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PaymentResult[] | null>(null);

  const normalizedTotal = useMemo(() => {
    return groups.reduce((sum, group) => {
      return sum + group.bills.reduce((inner, bill) => {
        const state = billState[bill.id];
        const parsed = state ? Number.parseFloat(state.amount || "0") : 0;
        const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        return inner + value;
      }, 0);
    }, 0);
  }, [billState, groups]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payloadGroups = groups.map((group) => {
      const key = group.bankGlAccountId ?? "none";
      const groupMeta = groupState[key] ?? { queueForPrinting: false };
      const items = group.bills.map((bill) => {
        const state = billState[bill.id];
        const amount = Number.parseFloat(state?.amount || "0");
        return {
          billId: bill.id,
          bankGlAccountId: bill.bankGlAccountId,
          payDate: state?.payDate || today,
          memo: state?.memo.trim() || undefined,
          checkNumber: state?.checkNumber.trim() || undefined,
          amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        };
      });
      return {
        bankGlAccountId: group.bankGlAccountId,
        queueForPrinting: groupMeta.queueForPrinting,
        items,
      };
    });

    const flatItems = payloadGroups.flatMap((g) => g.items);
    const hasValidAmount = flatItems.some((item) => item.amount > 0);
    if (!hasValidAmount) {
      setError("Enter at least one payment amount greater than zero.");
      return;
    }

    // Phase 4 only: post to a placeholder endpoint for the next phase.
    try {
      setSubmitting(true);
      const response = await fetch("/api/bills/payments/by-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: payloadGroups,
          totalAmount: normalizedTotal,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; results?: PaymentResult[] }
        | null;

      if (!response.ok || !data) {
        setError("Failed to create payments. Please try again.");
        return;
      }

      const outcome = Array.isArray(data.results) ? data.results : [];
      setResults(outcome);

      const failed = outcome.filter((r) => !r.success);
      const succeeded = outcome.filter((r) => r.success);

      if (!failed.length && succeeded.length) {
        // All succeeded – redirect back to pay-bills-by-check to refresh statuses.
        router.push("/accounting/pay-bills-by-check");
        router.refresh();
        return;
      }

      if (failed.length && !succeeded.length) {
        setError("All selected payments failed. Review details below and try again.");
        return;
      }

      if (failed.length && succeeded.length) {
        setError(
          "Some payments were created successfully, but others failed. Review the details below.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit payment right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent className="bg-card border-border/80 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-none border p-0 shadow-2xl sm:rounded-2xl">
        <DialogHeader className="border-border space-y-1 border-b px-6 pt-5 pb-4 text-left">
          <DialogTitle asChild>
            <Heading as="h1" size="h4">
              Prepare payment
            </Heading>
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-6 px-6 py-6" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Heading as="p" size="h5">
              {totalAmount.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </Heading>
            <Body as="p" tone="muted" size="sm">
              View and confirm the amounts on each check. This form will submit a
              normalized payload in the next phase.
            </Body>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to create payments</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {results && results.some((r) => !r.success) ? (
            <Alert>
              <AlertTitle>Payment results</AlertTitle>
              <AlertDescription>
                <p>
                  {results.filter((r) => r.success).length} payment(s) succeeded,{" "}
                  {results.filter((r) => !r.success).length} failed.
                </p>
                <ul className="mt-2 list-disc pl-4 text-xs">
                  {results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <li key={r.billId}>
                        Bill {r.billId}: {r.error || "Unknown error"}
                      </li>
                    ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          {groups.map((group) => {
            const key = group.bankGlAccountId ?? "none";
            const groupTotal = group.bills.reduce((sum, bill) => {
              const state = billState[bill.id];
              const amount = state ? Number.parseFloat(state.amount || "0") : 0;
              return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
            }, 0);
            const meta = groupState[key] ?? { queueForPrinting: false };

            return (
              <Card
                key={key}
                className="border-border/70 shadow-sm"
              >
                <CardContent className="space-y-4 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <Heading as="p" size="h6">
                        {group.bankLabel}{" "}
                        <span className="font-normal">
                          –{" "}
                          {groupTotal.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                          })}
                        </span>
                      </Heading>
                      <Body as="p" tone="muted" size="xs">
                        {group.bills.length} vendor
                        {group.bills.length === 1 ? "" : "s"} will receive check(s)
                      </Body>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`queue-printing-${key}`}
                        className="h-4 w-4"
                        checked={meta.queueForPrinting}
                        onChange={(event) =>
                          setGroupState((prev) => ({
                            ...prev,
                            [key]: {
                              queueForPrinting: event.target.checked,
                            },
                          }))
                        }
                      />
                      <label
                        htmlFor={`queue-printing-${key}`}
                        className="text-foreground text-sm"
                      >
                        Queue check(s) for printing
                      </label>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-border/60 bg-muted/30 border-b">
                          <th className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                            Vendor
                          </th>
                          <th className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                            Property
                          </th>
                          <th className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                            Pay date
                          </th>
                          <th className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                            Amount
                          </th>
                          <th className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                            Memo
                          </th>
                          <th className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                            Check no.
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.bills.map((bill) => {
                          const state = billState[bill.id];
                          return (
                            <tr
                              key={bill.id}
                              className="border-border/60 border-b"
                            >
                              <td className="text-foreground px-3 py-2">
                                {bill.vendorName}
                              </td>
                              <td className="text-foreground px-3 py-2">
                                {bill.propertyName || "—"}
                              </td>
                              <td className="px-3 py-2">
                                <DateInput
                                  id={`payDate-${bill.id}`}
                                  value={state?.payDate ?? today}
                                  onChange={(next) =>
                                    setBillState((prev) => ({
                                      ...prev,
                                      [bill.id]: {
                                        ...(prev[bill.id] ?? {
                                          payDate: today,
                                          amount: bill.remainingAmount.toFixed(2),
                                          memo: bill.propertyName || "",
                                          checkNumber: "",
                                        }),
                                        payDate: next,
                                      },
                                    }))
                                  }
                                  openOnFocus={false}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={state?.amount ?? bill.remainingAmount.toFixed(2)}
                                  onChange={(event) =>
                                    setBillState((prev) => ({
                                      ...prev,
                                      [bill.id]: {
                                        ...(prev[bill.id] ?? {
                                          payDate: today,
                                          amount: bill.remainingAmount.toFixed(2),
                                          memo: bill.propertyName || "",
                                          checkNumber: "",
                                        }),
                                        amount: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  placeholder={bill.propertyName || "Optional memo"}
                                  value={state?.memo ?? bill.propertyName ?? ""}
                                  onChange={(event) =>
                                    setBillState((prev) => ({
                                      ...prev,
                                      [bill.id]: {
                                        ...(prev[bill.id] ?? {
                                          payDate: today,
                                          amount: bill.remainingAmount.toFixed(2),
                                          memo: bill.propertyName || "",
                                          checkNumber: "",
                                        }),
                                        memo: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  placeholder="Optional"
                                  value={state?.checkNumber ?? ""}
                                  onChange={(event) =>
                                    setBillState((prev) => ({
                                      ...prev,
                                      [bill.id]: {
                                        ...(prev[bill.id] ?? {
                                          payDate: today,
                                          amount: bill.remainingAmount.toFixed(2),
                                          memo: bill.propertyName || "",
                                          checkNumber: "",
                                        }),
                                        checkNumber: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Confirm payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
