import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "./ui/alert";
import {
  Database,
  ChevronDown,
  Table as TableIcon,
  Link2,
  Key,
  FileText,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Building,
  Users,
  DollarSign,
  Wrench,
  BookOpen
} from "lucide-react";

const schemaDocumentation = {
  tables: {
    contacts: {
      purpose: "Master record for personal/business contact details (names, addresses, email, phone). Referenced by users, owners, tenants, and vendors.",
      keyFields: ["id", "first_name", "last_name", "email", "phone/phone_number", "address", "company_name", "user_id", "created_at", "updated_at"],
      relationships: ["users.contact_id", "rental_owners.contact_id", "tenants.contact_id", "vendors.contact_id"],
      notes: "Central hub for all contact information. Phone column may be 'phone' or 'phone_number' depending on setup."
    },
    users: {
      purpose: "Application users tied to Supabase Auth. Optional contact_id links to a contacts record.",
      keyFields: ["id", "email", "user_metadata", "contact_id", "created_at", "updated_at"],
      relationships: ["contacts.id", "staff.user_id", "user_roles.user_id"],
      notes: "Supabase Auth integration. Staff members reference this table."
    },
    roles: {
      purpose: "Role definitions (e.g., super_admin, property_manager).",
      keyFields: ["id", "name", "description", "permissions"],
      relationships: ["user_roles.role_id"],
      notes: "Defines system permissions and access levels."
    },
    user_roles: {
      purpose: "Many-to-many bridge between users and roles; composite key of (user_id, role_id).",
      keyFields: ["user_id", "role_id", "assigned_at"],
      relationships: ["users.id", "roles.id"],
      notes: "Manages user permissions through role assignments."
    },
    staff: {
      purpose: "Employees/agents (especially property managers). References a users row.",
      keyFields: ["id", "user_id", "title", "status", "created_at", "updated_at"],
      relationships: ["users.id", "properties.property_manager_id"],
      notes: "Property managers and other staff. Links to users table for auth."
    },
    bank_accounts: {
      purpose: "Bank accounts managed for properties. Optionally links to a general ledger (gl_accounts).",
      keyFields: ["id", "name", "account_type", "account_number", "routing_number", "user_id"],
      relationships: ["properties.operating_account", "properties.deposit_account"],
      notes: "Financial accounts for property operations and deposits."
    },
    gl_accounts: {
      purpose: "Chart-of-accounts entries (number, name, category).",
      keyFields: ["id", "number", "name", "category", "type"],
      relationships: ["transactions.gl_account_id", "transaction_allocations.gl_account_id"],
      notes: "General ledger structure for financial reporting."
    },
    properties: {
      purpose: "Real-estate assets with address, type, reserve balances, and manager (property_manager_id). Optionally ties to an operating bank account.",
      keyFields: ["id", "name", "address", "city", "state", "type", "property_manager_id", "operating_account", "deposit_account", "status", "user_id"],
      relationships: ["staff.id", "units.property_id", "ownership.property_id"],
      notes: "Core property records. Links to managers, units, and ownership through junction tables."
    },
    units: {
      purpose: "Individual rentable units tied to a property (property_id). Holds bedrooms, bathrooms, square footage, and market rent.",
      keyFields: ["id", "property_id", "unit_number", "bedrooms", "bathrooms", "square_footage", "market_rent"],
      relationships: ["properties.id", "leases.unit_id", "work_orders.unit_id"],
      notes: "Rental units within properties. Foundation for leases and maintenance."
    },
    rental_owners: {
      purpose: "Ownership entities (one per contact).",
      keyFields: ["id", "contact_id", "is_company", "user_id", "created_at", "updated_at"],
      relationships: ["contacts.id", "ownership.owner_id"],
      notes: "Owner entities that can own properties. Links to contacts for details."
    },
    ownership: {
      purpose: "Many-to-many link between properties and owners, tracking ownership and disbursement percentages, and a 'primary' flag.",
      keyFields: ["id", "property_id", "owner_id", "ownership_percent", "disbursement_percent", "is_primary"],
      relationships: ["properties.id", "rental_owners.id"],
      notes: "CRITICAL: Uses 'owner_id' not 'rental_owner_id'. Must total 100% ownership and disbursement. Exactly one primary owner per property."
    },
    tenants: {
      purpose: "Resident accounts linked to contacts. Tracks portal user linkage and lease status.",
      keyFields: ["id", "contact_id", "portal_user_id", "status", "user_id"],
      relationships: ["contacts.id", "lease_tenants.tenant_id"],
      notes: "Tenant records with contact information and lease associations."
    },
    leases: {
      purpose: "Lease agreements for a unit (unit_id) with term dates, rent, deposit, and status.",
      keyFields: ["id", "unit_id", "start_date", "end_date", "monthly_rent", "security_deposit", "status"],
      relationships: ["units.id", "lease_tenants.lease_id"],
      notes: "Lease contracts. Connected to tenants via lease_tenants junction table."
    },
    lease_tenants: {
      purpose: "Join table between leases and tenants with a role (primary, occupant, guarantor).",
      keyFields: ["lease_id", "tenant_id", "role", "move_in_date"],
      relationships: ["leases.id", "tenants.id"],
      notes: "Manages multiple tenants per lease with different roles."
    },
    vendors: {
      purpose: "Service providers; each references a contact.",
      keyFields: ["id", "contact_id", "vendor_type", "specialties", "user_id"],
      relationships: ["contacts.id", "work_orders.vendor_id"],
      notes: "Maintenance and service vendors with contact information."
    },
    work_orders: {
      purpose: "Maintenance requests referencing a unit and optionally a vendor; tracks priority, status, schedule.",
      keyFields: ["id", "unit_id", "vendor_id", "title", "description", "priority", "status", "scheduled_date"],
      relationships: ["units.id", "vendors.id"],
      notes: "Maintenance tracking system tied to units and vendors."
    },
    transactions: {
      purpose: "Financial postings (charges, payments, bills, etc.) tied to GL accounts and optionally a lease, unit, or property.",
      keyFields: ["id", "type", "amount", "description", "gl_account_id", "lease_id", "unit_id", "property_id"],
      relationships: ["gl_accounts.id", "leases.id", "units.id", "properties.id"],
      notes: "Core financial transaction records with GL account linkage."
    },
    transaction_allocations: {
      purpose: "Splits a transaction among multiple GL accounts.",
      keyFields: ["id", "transaction_id", "gl_account_id", "amount", "percentage"],
      relationships: ["transactions.id", "gl_accounts.id"],
      notes: "Enables complex transaction splits across multiple accounts."
    },
    payment_applications: {
      purpose: "Applies a payment transaction to a charge transaction.",
      keyFields: ["id", "payment_transaction_id", "charge_transaction_id", "amount_applied"],
      relationships: ["transactions.id", "transactions.id"],
      notes: "Links payments to specific charges for accurate accounting."
    },
    documents: {
      purpose: "File metadata for uploads associated with a property, unit, lease, etc.",
      keyFields: ["id", "filename", "file_type", "file_size", "property_id", "unit_id", "lease_id"],
      relationships: ["properties.id", "units.id", "leases.id"],
      notes: "Document management system with entity associations."
    }
  },
  relationships: {
    "Properties → Units": "One property has many units (units.property_id)",
    "Properties → Owners": "Many-to-many via ownership (property_id, owner_id). Owners originate from rental_owners, which link to a contact",
    "Properties → Staff": "A property optionally references a manager in staff",
    "Units → Leases": "Each lease associates with one unit; a unit can have multiple leases over time",
    "Leases → Tenants": "Many-to-many through lease_tenants with a role per tenant",
    "Users & Roles": "user_roles assigns roles to users. staff provides an employee profile for a user",
    "Contacts": "Central reference for people or organizations; used by users, owners, tenants, and vendors",
    "Financial": "transactions link to gl_accounts and optionally to leases, units, and properties",
    "Work Orders": "Each work order belongs to a unit and may reference a vendor"
  },
  businessLogic: {
    "Property creation": "Inserts into properties, optional bulk insert into units, and owner linkages via ownership. Also creates contacts and rental-owner records.",
    "Property manager workflow": "Searches staff joined with users and contacts; new managers involve inserting contacts, creating auth users, assigning roles, and inserting staff records.",
    "Tenant and lease management": "Leases are created for units, then tenants are associated via lease_tenants.",
    "Maintenance tracking": "Work orders record issues per unit; property managers or tenants query them based on role.",
    "Financial operations": "Transactions capture charges/payments and link to GL accounts, leases, and properties; allocations and payment applications handle detailed accounting.",
    "Document storage": "Files like leases or invoices stored in documents, tied to relevant entities."
  },
  constraints: {
    "Primary keys": "Usually UUIDs (id columns); roles uses an integer",
    "Foreign keys": "Enforce integrity across relationships (e.g., units.property_id → properties.id with cascading deletes)",
    "Check/enum constraints": "Enums for rental subtypes, tenant roles, work-order statuses, transaction types, etc.",
    "Triggers": "update_updated_at_column ensures updated_at reflects the latest modification",
    "Row-Level Security": "Enabled on all tables, with policies ensuring only authorized users can read or modify data"
  }
};

const frontendMapping = {
  "Properties Component": {
    tables: ["properties", "ownership", "staff", "bank_accounts"],
    description: "Property list with ownership data and manager assignments"
  },
  "OwnerSearch Component": {
    tables: ["rental_owners", "contacts", "ownership"],
    description: "Owner search and selection with ownership percentages"
  },
  "PropertyManagerSearch": {
    tables: ["staff", "users", "contacts"],
    description: "Staff member search and assignment to properties"
  },
  "Tenants Component": {
    tables: ["tenants", "leases", "lease_tenants", "properties", "units"],
    description: "Tenant management with lease details and property references"
  },
  "RentTracking Component": {
    tables: ["transactions", "leases", "tenants", "gl_accounts"],
    description: "Financial tracking of rent payments and charges"
  },
  "Maintenance Component": {
    tables: ["work_orders", "units", "vendors", "properties"],
    description: "Maintenance request tracking and vendor management"
  }
};

export function DatabaseSchemaGuide() {
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-8 h-8 text-primary" />
        <div>
          <h1>Database Schema Guide</h1>
          <p className="text-muted-foreground">
            Comprehensive reference for your Supabase database structure and relationships
          </p>
        </div>
      </div>

      <Tabs defaultValue="tables" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="business-logic">Business Logic</TabsTrigger>
          <TabsTrigger value="constraints">Constraints</TabsTrigger>
          <TabsTrigger value="frontend">Frontend Mapping</TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="w-5 h-5" />
                Table Structures & Purposes
              </CardTitle>
              <CardDescription>
                Detailed breakdown of each table in your Supabase database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(schemaDocumentation.tables).map(([tableName, table]) => (
                  <Collapsible key={tableName} open={expandedSections[tableName]}>
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleSection(tableName)}
                      >
                        <div className="flex items-center gap-3">
                          <TableIcon className="w-4 h-4 text-primary" />
                          <div>
                            <div className="font-medium text-left">{tableName}</div>
                            <div className="text-sm text-muted-foreground text-left">
                              {table.purpose.substring(0, 80)}...
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections[tableName] ? 'rotate-180' : ''}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3 p-4 border-l-4 border-primary/20 space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Purpose</h4>
                          <p className="text-sm text-muted-foreground">{table.purpose}</p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Key Fields</h4>
                          <div className="flex flex-wrap gap-2">
                            {table.keyFields.map(field => (
                              <Badge key={field} variant="outline" className="font-mono text-xs">
                                {field}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Relationships</h4>
                          <div className="flex flex-wrap gap-2">
                            {table.relationships.map(rel => (
                              <Badge key={rel} variant="secondary" className="text-xs">
                                {rel}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        {table.notes && (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Important Notes</AlertTitle>
                            <AlertDescription>{table.notes}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Relationships & Join Logic
              </CardTitle>
              <CardDescription>
                How tables connect and reference each other
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(schemaDocumentation.relationships).map(([relationship, description]) => (
                  <div key={relationship} className="flex items-start gap-3 p-3 border rounded-md">
                    <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">{relationship}</div>
                      <div className="text-sm text-muted-foreground mt-1">{description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business-logic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Data Usage Patterns & Business Logic
              </CardTitle>
              <CardDescription>
                How data flows through your application workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(schemaDocumentation.businessLogic).map(([pattern, description]) => (
                  <div key={pattern} className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">{pattern}</h4>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="constraints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Constraints & References
              </CardTitle>
              <CardDescription>
                Database constraints, indexes, and security policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(schemaDocumentation.constraints).map(([constraint, description]) => (
                  <div key={constraint} className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">{constraint}</h4>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <Alert className="mt-6">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Critical Schema Corrections</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 mt-2">
                    <div><strong>✅ Correct Table:</strong> Use "ownership" table (not "property_owners")</div>
                    <div><strong>✅ Correct Column:</strong> Use "owner_id" field (not "rental_owner_id")</div>
                    <div><strong>✅ Validation Rules:</strong> 100% ownership/disbursement totals, exactly one primary owner</div>
                    <div><strong>✅ Phone Column:</strong> May be "phone" or "phone_number" - detect dynamically</div>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frontend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Frontend Component Mapping
              </CardTitle>
              <CardDescription>
                How database tables map to frontend components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(frontendMapping).map(([component, mapping]) => (
                  <div key={component} className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      {component.includes('Properties') && <Building className="w-4 h-4" />}
                      {component.includes('Owner') && <Users className="w-4 h-4" />}
                      {component.includes('Manager') && <Users className="w-4 h-4" />}
                      {component.includes('Tenant') && <Users className="w-4 h-4" />}
                      {component.includes('Rent') && <DollarSign className="w-4 h-4" />}
                      {component.includes('Maintenance') && <Wrench className="w-4 h-4" />}
                      {component}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">{mapping.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {mapping.tables.map(table => (
                        <Badge key={table} variant="outline" className="text-xs">
                          {table}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Alert className="mt-6">
                <Database className="h-4 w-4" />
                <AlertTitle>Development Guidelines</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 mt-2">
                    <div><strong>Schema-First:</strong> Always reference this guide when writing queries</div>
                    <div><strong>Relationship Validation:</strong> Ensure foreign keys and joins use correct table/column names</div>
                    <div><strong>Business Rule Enforcement:</strong> Validate percentage totals and primary owner requirements</div>
                    <div><strong>Error Handling:</strong> Provide schema-aware error messages with table structure hints</div>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}