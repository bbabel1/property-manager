# Domain Model Overview

The platform centers on property portfolios and monthly accounting. Core entities are organized into domain modules under `src/modules/<domain>/`:

- **Properties & units:** Properties contain units, amenities, and media; associations live in `src/modules/properties` and `src/modules/units`.
- **People:** Owners, tenants, staff, and vendors model relationships and roles for leasing, billing, and maintenance (`src/modules/owners`, `src/modules/tenants`, `src/modules/staff`, `src/modules/vendors`).
- **Leasing:** Leases connect tenants to units and owners, track contacts, rents, deposits, and statuses (`src/modules/leases`).
- **Banking & transactions:** Bank accounts, journal entries, reconciliations, and bills represent cash flow and approvals (`src/modules/banking`, `src/modules/reconciliations`, `src/modules/bills`).
- **Monthly logs:** Logs and statements aggregate activity, tasks, and PDFs per month (`src/modules/monthly-logs`).
- **Files & workflows:** Files attach to any entity; maintenance/work orders and tasks track operational work (`src/modules/files`, `src/modules/maintenance`, `src/modules/tasks`).

Each module maintains its own schemas, services, and UI entrypoints; cross-cutting permissions, auth, and validation helpers live in `src/lib`.
