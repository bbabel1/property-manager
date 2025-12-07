# Tenant Isolation Coverage (service-role routes)

Status legend: ✅ guarded & scoped, ⚠️ partial, ⛔ needs guard

| Route                                | Risk            | Status | Notes |
|--------------------------------------|-----------------|--------|-------|
| /api/admin/memberships               | Write (elevate) | ✅     | Org admin check + platform_admin gating |
| /api/admin/memberships/simple        | Write (elevate) | ✅     | Org admin check + platform_admin gating |
| /api/tenants/[id] (PATCH)            | Write PII       | ✅     | Org admin guard + org_id filter |
| /api/vendors/[vendorId] (PATCH)      | Write vendor    | ✅     | Org admin guard + org_id filter |
| /api/middleware org role check       | Infra           | ✅     | Org-scoped roles enforced |
| /api/owners/[id] (GET)               | Sensitive read  | ✅     | Org member guard + org_id filter |
| /api/monthly-logs/[logId] (GET)      | Sensitive read  | ✅     | Org member guard + org_id filter |
| /api/admin/contacts (POST)           | Write contact   | ✅     | Restricted to platform_admin |
| /api/admin/users (GET)               | List memberships| ✅     | Restricted to platform_admin |
| /api/buildium/properties/[id]/notes  | Notes read/write| ✅     | Org member/admin guard via property org_id |
| /api/buildium/work-orders (GET/POST) | Sync/search     | ✅     | Platform_admin only |
| /api/buildium/work-orders/[id]       | Get/update      | ✅     | Platform_admin only |
| /api/buildium/owners/sync            | Owner sync      | ✅     | Platform_admin only |
| /api/buildium/owners/[id]/sync       | Owner sync one  | ✅     | Platform_admin only |
| /api/buildium/bills/[id]/sync        | Bill sync       | ✅     | Platform_admin only |
| /api/buildium/bills/sync/to-buildium | Bill push       | ✅     | Platform_admin only |
| /api/buildium/bills/[id]/files/[fileId]| Bill files    | ✅     | Platform_admin only |
| /api/buildium/bills/payments         | Bill payments   | ✅     | Platform_admin only |
| /api/buildium/bank-accounts/reconciliations | Reconciliations | ✅ | Platform_admin only |
| /api/buildium/bank-accounts/*        | Bank finance    | ✅     | Platform_admin (transfers, withdrawals, deposits, quick-deposits, reconciliations detail/transactions, checks, sync) |
| /api/buildium/general-ledger/*       | GL finance      | ✅     | Platform_admin only (accounts/entries/transactions/balances) |
| Buildium leases (all subroutes)      | Lease finance   | ✅     | Platform_admin only |
| Buildium files & categories          | Files           | ✅     | Platform_admin only |
| Buildium vendors/tenants             | Vendors/Tenants | ✅     | Platform_admin only |
| Buildium properties (listed routes)  | Properties/Units| ✅     | Platform_admin only |
| Buildium units/tasks (listed routes) | Tasks/units     | ✅     | Platform_admin only (units, notes, images, amenities; tasks + history + files) |
| Buildium owner/tenant requests       | Requests        | ✅     | Platform_admin only (resident-requests, todo-requests, owner-requests + contribution) |
| Buildium appliances                  | Assets          | ✅     | Platform_admin only (appliances + service history) |
| Buildium sync routes (service role)  | Mixed           | ⚠️     | Audit and add org scoping where applicable |
