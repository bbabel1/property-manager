"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  buttonVariants,
} from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Trash2 } from 'lucide-react';
import BillFileAttachmentsCard from '@/components/bills/BillFileAttachmentsCard';
import { cn } from '@/components/ui/utils';
import type { Database } from '@/types/database';

const TASK_KIND_OPTIONS: Array<{
  value: Database['public']['Enums']['task_kind_enum'];
  label: string;
}> = [
  { value: 'contact', label: 'Contact request' },
  { value: 'resident', label: 'Resident request' },
  { value: 'todo', label: 'To do' },
  { value: 'owner', label: 'Rental owner request' },
  { value: 'other', label: 'Other' },
];

type ResidentOption = {
  value: string;
  label: string;
  meta?: {
    property?: string | null;
    unit?: string | null;
  };
};

type ExpenseAccountOption = {
  id: string;
  name: string;
  accountNumber: string | null;
};

export default function AddWorkOrderPage() {
  const [taskType, setTaskType] = useState<Database['public']['Enums']['task_kind_enum'] | ''>('');
  const [residentOptions, setResidentOptions] = useState<ResidentOption[]>([]);
  const [residentLoading, setResidentLoading] = useState(false);
  const [residentError, setResidentError] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState('');
  const [residentsFetched, setResidentsFetched] = useState(false);
  const [expenseAccounts, setExpenseAccounts] = useState<ExpenseAccountOption[]>([]);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [selectedExpenseAccount, setSelectedExpenseAccount] = useState('');
  const isResidentRequest = taskType === 'resident';

  useEffect(() => {
    if (!isResidentRequest) {
      setSelectedResident('');
    } else {
      // Clear any previous error when the resident selector becomes visible again.
      setResidentError(null);
    }
  }, [isResidentRequest]);

  useEffect(() => {
    if (!isResidentRequest) return;
    if (residentsFetched || residentLoading) return;

    let isActive = true;
    const loadResidents = async () => {
      setResidentLoading(true);
      setResidentError(null);
      try {
        const response = await fetch('/api/tenants/active');
        if (!isActive) return;
        if (!response.ok) {
          setResidentError('Unable to load residents right now.');
          setResidentOptions([]);
          return;
        }
        const payload = (await response.json()) as {
          success?: boolean;
          data?: ResidentOption[];
          error?: string;
        };
        if (!payload?.success || !Array.isArray(payload.data)) {
          setResidentError(payload?.error || 'Unable to load residents right now.');
          setResidentOptions([]);
          return;
        }
        setResidentOptions(payload.data);
        setResidentsFetched(true);
      } catch (error) {
        if (!isActive) return;
        console.error('Failed to load active residents', error);
        setResidentError('Unable to load residents right now.');
        setResidentOptions([]);
        setResidentsFetched(true);
      } finally {
        if (!isActive) return;
        setResidentLoading(false);
      }
    };

    void loadResidents();

    return () => {
      isActive = false;
    };
  }, [isResidentRequest, residentsFetched, residentLoading]);

  useEffect(() => {
    let isActive = true;
    const loadExpenseAccounts = async () => {
      setExpenseLoading(true);
      setExpenseError(null);
      try {
        const response = await fetch('/api/gl-accounts/expense');
        if (!isActive) return;
        if (!response.ok) {
          setExpenseError('Unable to load expense accounts right now.');
          setExpenseAccounts([]);
          return;
        }
        const payload = (await response.json()) as {
          success?: boolean;
          data?: ExpenseAccountOption[];
          error?: string;
        };
        if (!payload?.success || !Array.isArray(payload.data)) {
          setExpenseError(payload?.error || 'Unable to load expense accounts right now.');
          setExpenseAccounts([]);
          return;
        }
        setExpenseAccounts(payload.data);
      } catch (error) {
        if (!isActive) return;
        console.error('Failed to load expense accounts', error);
        setExpenseError('Unable to load expense accounts right now.');
        setExpenseAccounts([]);
      } finally {
        if (!isActive) return;
        setExpenseLoading(false);
      }
    };

    void loadExpenseAccounts();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 p-6 pb-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Add work order</h1>
        <p className="text-muted-foreground text-sm">
          Capture task details, vendor information, and cost estimates for this work order.
        </p>
      </div>

      <form className="flex flex-col gap-6">
        <Card className="border border-border/70 shadow-sm">
          <CardContent className="px-8 py-8">
            <div className="space-y-10">
            <section className="flex flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg text-foreground">Task details</CardTitle>
                  <CardDescription>
                    Set up the maintenance task and choose who should participate.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col items-start gap-2 text-sm font-medium text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                <span className="text-xs font-semibold uppercase tracking-wide">Add to task</span>
                <div className="inline-flex rounded-full border border-border bg-muted/30 p-1">
                  <button
                    type="button"
                    className="rounded-full bg-background px-4 py-1.5 text-foreground shadow-sm transition-colors"
                  >
                    Create new task
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-4 py-1.5 transition-colors hover:text-foreground"
                  >
                    Add to existing task
                  </button>
                </div>
                </div>
              </div>

            <div className="space-y-6">
              <div className="space-y-1.5 max-w-xl">
                <Label htmlFor="task-type">Task type</Label>
                <Select
                  value={taskType || undefined}
                  onValueChange={(value) =>
                    setTaskType(value as Database['public']['Enums']['task_kind_enum'])
                  }
                >
                  <SelectTrigger id="task-type">
                    <SelectValue placeholder="Select task type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_KIND_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="task_kind" value={taskType} />
              </div>
              <div className="space-y-1.5 max-w-xl">
                <Label htmlFor="task-category">Category</Label>
                <Select>
                  <SelectTrigger id="task-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="landscaping">Landscaping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 max-w-xl">
                <Label htmlFor="assigned-to">
                  Assigned to (required)
                </Label>
                <Select>
                  <SelectTrigger id="assigned-to">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brandon-babel">Brandon Babel</SelectItem>
                    <SelectItem value="vernon">Vernon Amerson</SelectItem>
                    <SelectItem value="tammy">Tammy Rivera</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 max-w-xl">
                <Label htmlFor="collaborators">Collaborators</Label>
                <Select>
                  <SelectTrigger id="collaborators">
                    <SelectValue placeholder="Select collaborators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No collaborators</SelectItem>
                    <SelectItem value="staff">Maintenance staff</SelectItem>
                    <SelectItem value="owners">Notify owners</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isResidentRequest ? (
                <div className="space-y-1.5 max-w-xl">
                  <Label htmlFor="resident">Resident</Label>
                  <Select
                    value={selectedResident || undefined}
                    onValueChange={(value) => setSelectedResident(value)}
                    disabled={residentLoading && residentOptions.length === 0}
                  >
                    <SelectTrigger id="resident">
                      <SelectValue placeholder={residentLoading ? 'Loading residents…' : 'Select resident'} />
                    </SelectTrigger>
                    <SelectContent>
                      {residentLoading ? (
                        <SelectItem value="__loading" disabled>
                          Loading residents…
                        </SelectItem>
                      ) : residentOptions.length === 0 ? (
                        <SelectItem value="__empty" disabled>
                          No active residents found
                        </SelectItem>
                      ) : (
                        residentOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="tenant_id" value={selectedResident} />
                  {residentError ? (
                    <p className="text-xs text-destructive flex flex-wrap items-center gap-2">
                      <span>{residentError}</span>
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={() => {
                          setResidentsFetched(false);
                          setResidentOptions([]);
                          setResidentError(null);
                        }}
                      >
                        Retry
                      </button>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            </section>
            <div className="border-t border-border/70" />

            <section className="space-y-6">
              <div className="space-y-1.5">
                <CardTitle className="text-lg text-foreground">Work order details</CardTitle>
                <CardDescription>
                  Provide specific instructions, vendor preferences, and scheduling expectations.
                </CardDescription>
              </div>

              <div className="space-y-6">
                <div className="space-y-1.5 max-w-2xl">
                  <Label htmlFor="subject">Subject (required)</Label>
                  <Input id="subject" placeholder="Summarize the work to be done" />
                </div>
                <div className="space-y-1.5 max-w-xl">
                  <Label htmlFor="vendor">Vendor (required)</Label>
                  <Select>
                    <SelectTrigger id="vendor">
                      <SelectValue placeholder="Select or add new..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="premier-air">Premier Air Conditioning &amp; Heating</SelectItem>
                      <SelectItem value="hank">Hank the Handyman</SelectItem>
                    <SelectItem value="new">Invite new vendor</SelectItem>
                  </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 max-w-xl">
                  <Label htmlFor="entry-details">Entry details</Label>
                  <Select>
                    <SelectTrigger id="entry-details">
                      <SelectValue placeholder="Select entry preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super">Coordinate with building staff</SelectItem>
                      <SelectItem value="tenant">Tenant will provide access</SelectItem>
                    <SelectItem value="key">Use office key</SelectItem>
                  </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 max-w-xl">
                  <Label htmlFor="entry-contact">Entry contact</Label>
                  <Select>
                    <SelectTrigger id="entry-contact">
                      <SelectValue placeholder="Select entry contact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tenant">Tenant</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="manager">Property manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-1.5 max-w-2xl">
                  <Label htmlFor="work-description">Work to be performed</Label>
                  <Textarea
                    id="work-description"
                    rows={4}
                    placeholder="Tell the vendor what you need done"
                  />
                </div>
                <div className="space-y-1.5 max-w-2xl">
                  <Label htmlFor="vendor-notes">Vendor notes</Label>
                  <Textarea
                    id="vendor-notes"
                    rows={4}
                    placeholder="Add any notes from vendors here"
                  />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="space-y-1.5 lg:col-span-12 max-w-xl">
                  <Label htmlFor="status">Status</Label>
                  <Select defaultValue="new">
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in-progress">In progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on-hold">On hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 lg:col-span-12 max-w-xl">
                  <Label htmlFor="priority">Priority</Label>
                  <Select defaultValue="normal">
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 lg:col-span-12 max-w-xl">
                  <Label htmlFor="due-date">Due date</Label>
                  <DateInput id="due-date" />
                </div>
              </div>
            </section>
            <div className="border-t border-border/70" />

            <section className="space-y-6">
              <BillFileAttachmentsCard billId="new-work-order" uploaderName={null} />
            </section>
            <div className="border-t border-border/70" />

            <section className="space-y-6">
              <div className="space-y-1.5">
                <CardTitle className="text-lg text-foreground">Work order billing</CardTitle>
                <CardDescription>
                  Track invoice references and itemized costs for parts and labor.
                </CardDescription>
              </div>
              <div className="space-y-6">
                <div className="space-y-1.5 max-w-xl">
                  <Label htmlFor="invoice-number">Invoice number</Label>
                  <Input id="invoice-number" placeholder="Enter invoice number" />
                </div>
                <div className="space-y-1.5 max-w-xl">
                  <Label htmlFor="charge-to">Charge work to</Label>
                  <Input id="charge-to" placeholder="Specify account or unit" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <Table className="min-w-[820px]">
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <TableHead className="w-20 text-xs font-semibold">Qty</TableHead>
                        <TableHead className="text-xs font-semibold">Account</TableHead>
                        <TableHead className="text-xs font-semibold">Description</TableHead>
                        <TableHead className="w-32 text-xs font-semibold text-right">Price</TableHead>
                        <TableHead className="w-32 text-xs font-semibold text-right">Total</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-t border-border/70 bg-background">
                        <TableCell>
                          <Input aria-label="Quantity" defaultValue="1" className="w-20" />
                        </TableCell>
                        <TableCell className="max-w-xs min-w-[240px]">
                          <Label className="sr-only" htmlFor="expense-account">
                            Expense account
                          </Label>
                          <Select
                            value={selectedExpenseAccount || undefined}
                            onValueChange={setSelectedExpenseAccount}
                            disabled={expenseLoading && expenseAccounts.length === 0}
                          >
                            <SelectTrigger id="expense-account">
                              <SelectValue
                                placeholder={
                                  expenseLoading ? 'Loading accounts…' : 'Select expense account'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {expenseLoading ? (
                                <SelectItem value="__loading" disabled>
                                  Loading accounts…
                                </SelectItem>
                              ) : expenseAccounts.length === 0 ? (
                                <SelectItem value="__empty" disabled>
                                  No expense accounts available
                                </SelectItem>
                              ) : (
                                expenseAccounts.map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.name}
                                    {account.accountNumber ? ` · ${account.accountNumber}` : ''}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <input type="hidden" name="lines[0][account_id]" value={selectedExpenseAccount} />
                          {expenseError ? (
                            <p className="mt-2 text-xs text-destructive">{expenseError}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Input aria-label="Description" placeholder="Describe the item or service" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input aria-label="Price" placeholder="$0.00" className="text-right" />
                        </TableCell>
                        <TableCell className="text-right font-medium text-muted-foreground">
                          $0.00
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  aria-label="Remove row"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <span>Remove row</span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/20 font-semibold">
                        <TableCell colSpan={4} className="text-right">
                          Total
                        </TableCell>
                        <TableCell className="text-right">$0.00</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </section>
          </div>
            <div className="border-t border-border/70" />

            <div className="flex flex-wrap items-center gap-3 pt-6">
              <Button type="submit">Create work order</Button>
              <Button type="button" variant="outline">
                Add another work order
              </Button>
              <Link
                href="/maintenance"
                className={cn(buttonVariants({ variant: 'ghost' }), 'text-muted-foreground')}
              >
                Cancel
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
