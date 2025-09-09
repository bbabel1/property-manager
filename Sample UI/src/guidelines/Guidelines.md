**Add your own guidelines here**
<!--
# General guidelines
System Guidelines

The repository includes a Supabase SQL migration that defines the core database entities for a property-management system. The schema is primarily composed of the following tables and supporting policies.

# Tables

* bank_accounts – Stores bank accounts used by properties. Optionally links to a GL account.
  Key Columns: id (UUID), name, routing_last4, gl_account_id (FK to gl_accounts)
  Example: SELECT * FROM bank_accounts WHERE name ILIKE '%operating%';

* gl_accounts – General ledger chart accounts for financial transactions.
  Key Columns: id, number (unique), name, category
  Example: SELECT number, name FROM gl_accounts ORDER BY number;

* properties – Real-estate properties under management.
  Key Columns: id, address fields, type, optional operating_bank_account_id (FK to bank_accounts)
  Example: SELECT name, city, state FROM properties WHERE state = 'CA';

* units – Individual rental units within properties.
  Key Columns: id, property_id (FK), unit_number, bedrooms, bathrooms, market_rent; unique (property_id, unit_number)
  Example: SELECT * FROM units WHERE property_id = :prop_id ORDER BY unit_number;

* owners – Person or entity owners.
  Key Columns: id, first_name, last_name, email (unique)
  Example: SELECT * FROM owners WHERE email = :email;

* property_owners – Junction table linking properties to owners and ownership percentage.
  Key Columns: Composite PK (property_id, owner_id)
  Example:
    SELECT o.* FROM owners o
    JOIN property_owners po ON po.owner_id=o.id
    WHERE po.property_id=:prop_id;

* tenants – Tenant contact information.
  Key Columns: id, first_name, last_name, email (unique)
  Example: SELECT * FROM tenants WHERE last_name ILIKE 'Smith%';

* leases – Lease agreements for units.
  Key Columns: id, unit_id (FK), start_date, end_date, rent, status (enum), security_deposit
  Example: SELECT * FROM leases WHERE unit_id = :unit_id AND status = 'active';

* lease_tenants – Junction table linking tenants to leases with role (primary/occupant/guarantor).
  Key Columns: Composite PK (lease_id, tenant_id)
  Example:
    SELECT lt.role, t.first_name
    FROM lease_tenants lt
    JOIN tenants t ON t.id=lt.tenant_id
    WHERE lt.lease_id=:lease_id;

* vendors – Service vendors for maintenance.
  Key Columns: id, company_name, contact_name, phone, specialty
  Example: SELECT * FROM vendors WHERE specialty = 'Plumbing';

* work_orders – Maintenance work orders referencing units and optional vendor.
  Key Columns: id, unit_id (FK), vendor_id (FK), description, priority, status
  Example: SELECT * FROM work_orders WHERE status='open' ORDER BY priority DESC;

* transactions – Financial transactions tied to GL accounts, properties, leases, or units.
  Key Columns: id, gl_account_id (FK), lease_id, unit_id, property_id, amount, type (debit/credit), date
  Example:
    SELECT date, amount
    FROM transactions
    WHERE property_id=:prop_id
    ORDER BY date DESC;

# Additional Tables Referenced in Later Migrations
Later migrations reference tables such as contacts, users, roles, user_roles, staff, rental_owners, ownership, documents, payment_applications, transaction_allocations, and kv_store_04fa0d09. These extend user/ownership management, document storage, and accounting features.

# Views
Earlier migrations created aggregate views:
  property_owner_ids – property → array of owner IDs.
  property_units – property → JSON array of units.
  properties_expanded – combined property data with owners and units.

Final migrations removed these views to enforce stricter RLS. They can be recreated if needed.

# Security and Triggers
- Row-Level Security (RLS) enabled for all core tables.
- Initial policies granted broad authenticated access; later policies are granular (e.g., property managers managing related work orders).
- Timestamps – Trigger update_updated_at_column auto-updates updated_at on changes.

# Query Examples

-- Listing Properties with Units
SELECT p.name, u.unit_number
FROM properties p
JOIN units u ON u.property_id = p.id
ORDER BY p.name, u.unit_number;

-- Finding Active Leases and Tenants
SELECT l.id AS lease_id, t.first_name, t.last_name
FROM leases l
JOIN lease_tenants lt ON lt.lease_id = l.id
JOIN tenants t ON t.id = lt.tenant_id
WHERE l.status = 'active';

-- Summarizing Transactions by GL Account
SELECT g.number, g.name,
       SUM(CASE WHEN t.type='debit' THEN t.amount ELSE -t.amount END) AS balance
FROM gl_accounts g
JOIN transactions t ON t.gl_account_id = g.id
GROUP BY g.number, g.name
ORDER BY g.number;

--------------

# Design system guidelines
Rules for how the AI should make generations look like your company's design system

Additionally, if you select a design system to use in the prompt box, you can reference
your design system's components, tokens, variables and components.
For example:

* Use a base font-size of 14px
* Date formats should always be in the format “Jun 10”
* The bottom toolbar should only ever have a maximum of 4 items
* Never use the floating action button with the bottom toolbar
* Chips should always come in sets of 3 or more
* Don't use a dropdown if there are 2 or fewer options

You can also create sub sections and add more specific details
For example:


## Button
The Button component is a fundamental interactive element in our design system, designed to trigger actions or navigate
users through the application. It provides visual feedback and clear affordances to enhance user experience.

### Usage
Buttons should be used for important actions that users need to take, such as form submissions, confirming choices,
or initiating processes. They communicate interactivity and should have clear, action-oriented labels.

### Variants
* Primary Button
  * Purpose : Used for the main action in a section or page
  * Visual Style : Bold, filled with the primary brand color
  * Usage : One primary button per section to guide users toward the most important action
* Secondary Button
  * Purpose : Used for alternative or supporting actions
  * Visual Style : Outlined with the primary color, transparent background
  * Usage : Can appear alongside a primary button for less important actions
* Tertiary Button
  * Purpose : Used for the least important actions
  * Visual Style : Text-only with no border, using primary color
  * Usage : For actions that should be available but not emphasized
-->
