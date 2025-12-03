'use client';

import { useState, useEffect } from 'react';
import { Calendar, DollarSign, CreditCard, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PAYMENT_METHOD_OPTIONS } from '@/lib/enums/payment-method';
import { toast } from 'sonner';

interface CreatePaymentFormProps {
  monthlyLogId: string;
  unitId: string;
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface GLAccount {
  id: string;
  name: string;
  account_number: string;
}

interface PaymentFormData {
  date: string;
  amount: string;
  payment_method: string;
  memo: string;
  allocations: Array<{
    account_id: string;
    amount: string;
  }>;
}

export default function CreatePaymentForm({
  monthlyLogId,
  unitId: _unitId,
  propertyId: _propertyId,
  isOpen,
  onClose,
  onSuccess,
}: CreatePaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [glLoading, setGlLoading] = useState(false);
  const [glError, setGlError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PaymentFormData>({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'Check',
    memo: '',
    allocations: [{ account_id: '', amount: '' }],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load GL accounts on mount
  useEffect(() => {
    if (isOpen) {
      loadGLAccounts();
    }
  }, [isOpen]);

  const loadGLAccounts = async () => {
    setGlLoading(true);
    setGlError(null);
    try {
      const response = await fetch('/api/gl-accounts?type=asset&subtype=receivable');
      if (response.ok) {
        const data = await response.json();
        setGlAccounts(data.accounts || []);
      } else {
        setGlError('Unable to load GL accounts. Please try again.');
      }
    } catch (error) {
      console.error('Failed to load GL accounts:', error);
      setGlError('Failed to load accounts');
      toast.error('Failed to load accounts');
    } finally {
      setGlLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) {
      newErrors.date = 'Payment date is required';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.payment_method) {
      newErrors.payment_method = 'Payment method is required';
    }

    // Validate allocations
    const totalAllocated = formData.allocations.reduce((sum, alloc) => {
      return sum + (parseFloat(alloc.amount) || 0);
    }, 0);

    const paymentAmount = parseFloat(formData.amount) || 0;
    if (Math.abs(totalAllocated - paymentAmount) > 0.01) {
      newErrors.allocations = 'Total allocations must equal payment amount';
    }

    formData.allocations.forEach((alloc, index) => {
      if (!alloc.account_id) {
        newErrors[`allocation_${index}_account`] = 'Account is required';
      }
      if (!alloc.amount || parseFloat(alloc.amount) <= 0) {
        newErrors[`allocation_${index}_amount`] = 'Amount must be greater than 0';
      }
    });

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const focusKey = Object.keys(newErrors)[0];
      let focusId: string | null = null;
      if (focusKey === 'payment_method') focusId = 'payment_method';
      else if (focusKey === 'date') focusId = 'date';
      else if (focusKey === 'amount') focusId = 'amount';
      else if (focusKey.startsWith('allocation_')) {
        const match = focusKey.match(/allocation_(\d+)_(account|amount)/);
        if (match) {
          const [, index, field] = match;
          focusId = `${field === 'account' ? 'account' : 'amount'}_${index}`;
        }
      }
      if (focusId) {
        setTimeout(() => {
          const el = document.getElementById(focusId);
          el?.focus();
        }, 0);
      }
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/monthly-logs/${monthlyLogId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: formData.date,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method,
          memo: formData.memo || null,
          allocations: formData.allocations.map((alloc) => ({
            account_id: alloc.account_id,
            amount: parseFloat(alloc.amount),
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create payment');
      }

      toast.success('Payment created successfully');
      onSuccess();
      onClose();

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_method: 'Check',
        memo: '',
        allocations: [{ account_id: '', amount: '' }],
      });
      setErrors({});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create payment';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const addAllocation = () => {
    setFormData((prev) => ({
      ...prev,
      allocations: [...prev.allocations, { account_id: '', amount: '' }],
    }));
  };

  const removeAllocation = (index: number) => {
    if (formData.allocations.length > 1) {
      setFormData((prev) => ({
        ...prev,
        allocations: prev.allocations.filter((_, i) => i !== index),
      }));
    }
  };

  const updateAllocation = (index: number, field: 'account_id' | 'amount', value: string) => {
    setFormData((prev) => ({
      ...prev,
      allocations: prev.allocations.map((alloc, i) =>
        i === index ? { ...alloc, [field]: value } : alloc,
      ),
    }));
  };

  const autoAllocateAmount = () => {
    const amount = parseFloat(formData.amount) || 0;
    if (amount > 0 && formData.allocations.length === 1) {
      setFormData((prev) => {
        const current = prev.allocations[0]?.amount ?? '';
        const nextValue = amount.toString();
        if (current === nextValue) return prev;
        return { ...prev, allocations: [{ ...prev.allocations[0], amount: nextValue }] };
      });
    }
  };

  useEffect(() => {
    autoAllocateAmount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.amount, formData.allocations.length]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Create Payment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Payment Date
                  </Label>
                  <DateInput
                    id="date"
                    value={formData.date}
                    onChange={(nextValue) => setFormData((prev) => ({ ...prev, date: nextValue }))}
                    className={errors.date ? 'border-red-500' : ''}
                  />
                  {errors.date && <p className="text-sm text-red-600">{errors.date}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Amount
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, amount: e.target.value }));
                      // Auto-allocate if only one allocation
                      if (formData.allocations.length === 1) {
                        setTimeout(autoAllocateAmount, 100);
                      }
                    }}
                    className={errors.amount ? 'border-red-500' : ''}
                    placeholder="0.00"
                  />
                  {errors.amount && <p className="text-sm text-red-600">{errors.amount}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Method
                </Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, payment_method: value }))
                  }
                >
                  <SelectTrigger
                    id="payment_method"
                    className={errors.payment_method ? 'border-red-500' : ''}
                  >
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.payment_method && (
                  <p className="text-sm text-red-600">{errors.payment_method}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="memo" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Memo
                </Label>
                <Textarea
                  id="memo"
                  value={formData.memo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
                  placeholder="Optional payment memo"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* GL Account Allocations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Allocations</CardTitle>
              <p className="text-sm text-slate-600">
                Allocate the payment amount to specific GL accounts
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.allocations.map((allocation, index) => (
                <div key={index} className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`account_${index}`}>GL Account</Label>
                    <Select
                      value={allocation.account_id}
                      onValueChange={(value) => updateAllocation(index, 'account_id', value)}
                    >
                      <SelectTrigger
                        id={`account_${index}`}
                        className={errors[`allocation_${index}_account`] ? 'border-red-500' : ''}
                      >
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {glLoading ? (
                          <SelectItem disabled value="loading">
                            Loading accounts…
                          </SelectItem>
                        ) : glAccounts.length === 0 ? (
                          <SelectItem disabled value="empty">
                            No GL accounts available
                          </SelectItem>
                        ) : (
                          glAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_number} - {account.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {glError ? <p className="text-sm text-red-600">{glError}</p> : null}
                    {errors[`allocation_${index}_account`] && (
                      <p className="text-sm text-red-600">
                        {errors[`allocation_${index}_account`]}
                      </p>
                    )}
                  </div>

                  <div className="w-32 space-y-2">
                    <Label htmlFor={`amount_${index}`}>Amount</Label>
                    <Input
                      id={`amount_${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={allocation.amount}
                      onChange={(e) => updateAllocation(index, 'amount', e.target.value)}
                      className={errors[`allocation_${index}_amount`] ? 'border-red-500' : ''}
                      placeholder="0.00"
                    />
                    {errors[`allocation_${index}_amount`] && (
                      <p className="text-sm text-red-600">{errors[`allocation_${index}_amount`]}</p>
                    )}
                  </div>

                  {formData.allocations.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeAllocation(index)}
                      className="px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {errors.allocations && <p className="text-sm text-red-600">{errors.allocations}</p>}

              <Button type="button" variant="outline" onClick={addAllocation} className="w-full">
                Add Another Allocation
              </Button>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
