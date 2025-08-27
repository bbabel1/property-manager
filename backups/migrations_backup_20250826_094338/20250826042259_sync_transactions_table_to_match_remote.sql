-- Migration: Sync transactions table to match remote database
-- Description: Rename fields to match remote schema case sensitivity
-- Author: Property Management System
-- Date: 2025-08-26

-- Rename columns to match remote schema case sensitivity
ALTER TABLE public.transactions RENAME COLUMN date TO "Date";
ALTER TABLE public.transactions RENAME COLUMN transactiontype TO "TransactionType";
ALTER TABLE public.transactions RENAME COLUMN totalamount TO "TotalAmount";
ALTER TABLE public.transactions RENAME COLUMN checknumber TO "CheckNumber";
ALTER TABLE public.transactions RENAME COLUMN payeetenantid TO "PayeeTenantId";
ALTER TABLE public.transactions RENAME COLUMN paymentmethod TO "PaymentMethod";
ALTER TABLE public.transactions RENAME COLUMN memo TO "Memo";
