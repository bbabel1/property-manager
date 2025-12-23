# supabaseAdmin Usage Audit (in-progress)

Legend: ✅ guarded + scoped; ⚠️ partial; ⛔ needs guard; N/A uses session client

Checked routes (representative/high-risk first):

- ✅ `src/app/api/admin/memberships/route.ts` – org admin check + platform_admin gating
- ✅ `src/app/api/admin/memberships/simple/route.ts` – org admin check + platform_admin gating
- ✅ `src/app/api/tenants/[id]/route.ts` – org admin guard + org_id filter (service role)
- ✅ `src/app/api/vendors/[vendorId]/route.ts` – org admin guard + org_id filter (service role)
- ✅ `src/app/api/owners/[id]/route.ts` – org member guard + org_id filter
- ✅ `src/app/api/monthly-logs/[logId]/route.ts` – org member guard + org_id filter
- ✅ `src/app/api/admin/contacts/route.ts` – platform_admin only
- ✅ `src/app/api/admin/users/route.ts` – platform_admin only
- ✅ `src/app/api/buildium/properties/[id]/notes/route.ts` – org member/admin guard via property org_id
- ✅ `src/app/api/buildium/work-orders/route.ts` – platform_admin only
- ✅ `src/app/api/buildium/work-orders/[id]/route.ts` – platform_admin only
- ✅ `src/app/api/buildium/owners/sync/route.ts` – platform_admin only
- ✅ `src/app/api/buildium/owners/[id]/sync/route.ts` – platform_admin only
- ✅ `src/app/api/buildium/bills/[id]/sync/route.ts` – platform_admin only
- ✅ `src/app/api/buildium/bills/sync/to-buildium/route.ts` – platform_admin only
- ✅ `src/app/api/buildium/bills/[id]/files/[fileId]/route.ts` – platform_admin only
- ✅ `src/app/api/buildium/bills/payments/route.ts` – platform_admin only
- ✅ `src/app/api/buildium/bank-accounts/reconciliations/route.ts` – platform_admin only
- ✅ Buildium bank accounts (platform_admin): `bank-accounts/route.ts`, `[id]/route.ts`, `[id]/reconciliations/route.ts`, `reconciliations/[id]/route.ts`, `reconciliations/[id]/transactions|clear-transactions|unclear-transactions`, `transfers`, `withdrawals`, `deposits`, `quick-deposits`, `checks` (and file routes), `sync`
- ✅ Buildium general-ledger (platform_admin): `general-ledger/accounts` (+`[id]`, `balances`, `sync`), `general-ledger/entries` (+`[id]`, `sync`), `general-ledger/transactions` (+`[id]`)
- ✅ Lease routes (platform_admin): `src/app/api/buildium/leases/route.ts`, `[buildiumLeaseId]/route.ts`, `transactions/route.ts`, `transactions/[transactionId]/route.ts`, `transactions/charges/route.ts`, `transactions/charges/[chargeId]/route.ts`, `transactions/outstanding-balances/route.ts`, `recurringtransactions/route.ts`, `recurringtransactions/[recurringId]/route.ts`, `moveouts/route.ts`, `moveouts/[moveOutId]/route.ts`, `notes/route.ts`, `notes/[noteId]/route.ts`
- ✅ Buildium files & categories (platform_admin): `files/route.ts`, `files/[id]/route.ts`, `files/[id]/sharesettings/route.ts`, `files/uploadrequests/route.ts`, `file-categories/route.ts`, `file-categories/[id]/route.ts`, `bills/[id]/files/route.ts`
- ✅ Buildium vendors/tenants (platform_admin): `vendors/route.ts`, `vendors/[id]/route.ts`, `vendors/[id]/credits/route.ts`, `vendors/[id]/credits/[creditId]/route.ts`, `vendors/[id]/refunds/route.ts`, `vendors/[id]/refunds/[refundId]/route.ts`, `vendors/[id]/notes/route.ts`, `vendors/[id]/notes/[noteId]/route.ts`, `vendors/[id]/transactions/route.ts`, `vendor-categories/route.ts`, `vendor-categories/[id]/route.ts`, `tenants/route.ts`, `tenants/[id]/notes/route.ts`, `tenants/[id]/notes/[noteId]/route.ts`
- ✅ Buildium properties (platform_admin): `properties/route.ts`, `properties/[id]/route.ts`, `properties/[id]/units/route.ts`, `properties/[id]/units/[unitId]/route.ts`, `properties/[id]/amenities/route.ts`, `properties/[id]/epay-settings/route.ts`, `properties/[id]/reactivate/route.ts`, `properties/[id]/inactivate/route.ts`, `properties/[id]/notes/[noteId]/route.ts`, `properties/[id]/preferred-vendors/route.ts`, `properties/[id]/images/[imageId]/route.ts`, `properties/[id]/images/video/route.ts`
- ✅ Buildium units/tasks (platform_admin): `units/route.ts`, `units/[id]/route.ts`, `units/[id]/amenities|notes|notes/[noteId]|images|images/[imageId]|images/video`, `tasks/route.ts`, `tasks/[id]/route.ts`, `tasks/[id]/history`, `tasks/[id]/history/[historyId]`, `tasks/[id]/history/[historyId]/files` (+`[fileId]`)
- ✅ Buildium owner/tenant request detail (platform_admin): `resident-requests/[id]`, `todo-requests/[id]`, `owner-requests/[id]`, `owner-requests/[id]/contribution`
- ✅ Appliances (platform_admin): `appliances/route.ts`, `appliances/[id]/route.ts`, `appliances/[id]/service-history`, `appliances/[id]/service-history/[serviceHistoryId]`
- ⚠️ Buildium sync routes (e.g., `/api/buildium/...`, `/api/work-orders/route.ts`) – service role; need org scoping audit per handler

Next to audit:

- Remaining Buildium sync orchestration routes (account-info, sync dashboards) – ensure platform_admin + rate limits and document any org-scoped requirements if added later.

Method:

- For each service-role usage, ensure: (1) resolve org_id from resource or request, (2) require org member/admin as appropriate, (3) filter by org_id, (4) avoid cross-org data when no org hint.
