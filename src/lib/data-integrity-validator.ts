// Data Integrity Validation System
// Ensures consistency across all entity relationships and Buildium sync operations

import type { TypedSupabaseClient } from './db'
import type { Database } from '@/types/database'

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  orphanedRecords: OrphanedRecord[]
}

interface OrphanedRecord {
  table: string
  id: string
  buildiumId?: number | null
  reason: string
}

type DuplicateUnit = {
  property_id: string
  unit_number: string
  count: number
}

type DuplicateOwnership = {
  owner_id: string
  property_id: string
  count: number
}

type DuplicateBuildiumId = {
  buildium_id: number
  count: number
}

type PropertyRow = Database['public']['Tables']['properties']['Row']
type UnitRow = Database['public']['Tables']['units']['Row']
type LeaseRow = Database['public']['Tables']['lease']['Row']
type TenantRow = Database['public']['Tables']['tenants']['Row']
type ContactRow = Database['public']['Tables']['contacts']['Row']
type OwnerRow = Database['public']['Tables']['owners']['Row']
type OwnershipRow = Database['public']['Tables']['ownerships']['Row']

export class DataIntegrityValidator {
  private supabase: TypedSupabaseClient

  constructor(supabaseClient: TypedSupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Validate complete data integrity across all entities
   */
  async validateCompleteIntegrity(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      orphanedRecords: []
    }

    // Run all validation checks
    await Promise.all([
      this.validatePropertyRelationships(result),
      this.validateUnitRelationships(result),
      this.validateLeaseRelationships(result),
      this.validateTenantRelationships(result),
      this.validateContactRelationships(result),
      this.validateOwnerRelationships(result),
      this.validateOwnershipRelationships(result),
      this.validateBuildiumIdConsistency(result),
      this.validateRequiredFields(result)
    ])

    result.isValid = result.errors.length === 0
    return result
  }

  /**
   * Validate property relationships and constraints
   */
  private async validatePropertyRelationships(result: ValidationResult): Promise<void> {
    try {
      // Check for properties without units
      const { data: propertiesWithoutUnits } = await this.supabase
        .from('properties')
        .select('id, name, buildium_property_id')
        .not('id', 'in', `(SELECT property_id FROM units)`)

      const propertiesWithoutUnitsRows = (propertiesWithoutUnits ?? []) as Array<
        Pick<PropertyRow, 'id' | 'name' | 'buildium_property_id'>
      >;
      propertiesWithoutUnitsRows.forEach((property) => {
        result.warnings.push(`Property "${property.name}" (ID: ${property.id}) has no units`)
      })

      // Check for properties with invalid operating bank GL references
      const { data: propertiesWithBankGl } = await this.supabase
        .from('properties')
        .select('id, name, buildium_property_id, operating_bank_gl_account_id')
        .not('operating_bank_gl_account_id', 'is', null)

      const propertiesWithBankGlRows = (propertiesWithBankGl ?? []) as Array<
        Pick<PropertyRow, 'id' | 'name' | 'buildium_property_id' | 'operating_bank_gl_account_id'>
      >;
      const bankGlIds = propertiesWithBankGlRows
        .map((p) => p?.operating_bank_gl_account_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      let validBankGlIds = new Set<string>()
      if (bankGlIds.length) {
        const { data: bankRows } = await this.supabase
          .from('gl_accounts')
          .select('id')
          .in('id', bankGlIds)
        validBankGlIds = new Set((bankRows ?? []).map((row) => String(row.id)))
      }

      propertiesWithBankGlRows.forEach((property) => {
        const bankId = property?.operating_bank_gl_account_id
        if (!bankId || !validBankGlIds.has(String(bankId))) {
          result.errors.push(`Property "${property.name}" references non-existent bank GL account`)
          result.orphanedRecords.push({
            table: 'properties',
            id: property.id,
            buildiumId: property.buildium_property_id,
            reason: 'Invalid bank account reference'
          })
        }
      })

    } catch (error) {
      result.errors.push(`Property validation failed: ${getErrorMessage(error)}`)
    }
  }

  /**
   * Validate unit relationships
   */
  private async validateUnitRelationships(result: ValidationResult): Promise<void> {
    try {
      // Check for units without valid property references
      const { data: orphanedUnits } = await this.supabase
        .from('units')
        .select('id, unit_number, property_id, buildium_unit_id')
        .not('property_id', 'in', `(SELECT id FROM properties)`)

      const orphanedUnitRows = (orphanedUnits ?? []) as Array<
        Pick<UnitRow, 'id' | 'unit_number' | 'property_id' | 'buildium_unit_id'>
      >;
      orphanedUnitRows.forEach((unit) => {
        result.errors.push(`Unit "${unit.unit_number}" (ID: ${unit.id}) references non-existent property`)
        result.orphanedRecords.push({
          table: 'units',
          id: unit.id,
          buildiumId: unit.buildium_unit_id,
          reason: 'Invalid property reference'
        })
      })

      // Check for duplicate unit numbers within same property
      const { data: duplicateUnits } = await this.supabase
        .rpc('find_duplicate_units')

      ;(duplicateUnits as DuplicateUnit[] | null)?.forEach((duplicate) => {
        result.errors.push(`Duplicate unit number "${duplicate.unit_number}" in property ${duplicate.property_id}`)
      })

    } catch (error) {
      result.errors.push(`Unit validation failed: ${getErrorMessage(error)}`)
    }
  }

  /**
   * Validate lease relationships - most critical for data integrity
   */
  private async validateLeaseRelationships(result: ValidationResult): Promise<void> {
    try {
      // Check for leases without valid property/unit references
      const { data: invalidLeases } = await this.supabase
        .from('lease')
        .select(`
          id, buildium_lease_id, property_id, unit_id,
          property:properties!Lease_propertyId_fkey(id, name),
          unit:units!Lease_unitId_fkey(id, unit_number)
        `)
        .or('property.id.is.null,unit.id.is.null')

      const invalidLeaseRows = (invalidLeases ?? []) as Array<
        Pick<LeaseRow, 'id' | 'buildium_lease_id'> & {
          property: { id: string | null; name: string | null } | null
          unit: { id: string | null; unit_number: string | null } | null
        }
      >;
      invalidLeaseRows.forEach((lease) => {
        const missingRefs = []
        if (!lease.property) missingRefs.push('property')
        if (!lease.unit) missingRefs.push('unit')
        
        result.errors.push(`Lease (ID: ${lease.id}) missing ${missingRefs.join(', ')} reference(s)`)
        result.orphanedRecords.push({
          table: 'lease',
          id: lease.id.toString(),
          buildiumId: lease.buildium_lease_id,
          reason: `Missing ${missingRefs.join(', ')} reference`
        })
      })

      // Check for leases without tenant relationships
      const { data: leasesWithoutTenants } = await this.supabase
        .from('lease')
        .select('id, buildium_lease_id')
        .not('id', 'in', `(SELECT lease_id FROM lease_contacts)`)

      const leasesWithoutTenantsRows = (leasesWithoutTenants ?? []) as Array<
        Pick<LeaseRow, 'id' | 'buildium_lease_id'>
      >;
      leasesWithoutTenantsRows.forEach((lease) => {
        result.warnings.push(`Lease (ID: ${lease.id}) has no associated tenants`)
      })

    } catch (error) {
      result.errors.push(`Lease validation failed: ${getErrorMessage(error)}`)
    }
  }

  /**
   * Validate tenant and contact relationships
   */
  private async validateTenantRelationships(result: ValidationResult): Promise<void> {
    try {
      // Check for tenants without valid contact references
      const { data: orphanedTenants } = await this.supabase
        .from('tenants')
        .select('id, buildium_tenant_id, contact_id')
        .not('contact_id', 'in', `(SELECT id FROM contacts)`)

      const orphanedTenantRows = (orphanedTenants ?? []) as Array<
        Pick<TenantRow, 'id' | 'buildium_tenant_id' | 'contact_id'>
      >;
      orphanedTenantRows.forEach((tenant) => {
        result.errors.push(`Tenant (ID: ${tenant.id}) references non-existent contact`)
        result.orphanedRecords.push({
          table: 'tenants',
          id: tenant.id,
          buildiumId: tenant.buildium_tenant_id,
          reason: 'Invalid contact reference'
        })
      })

      // Check for lease_contacts with invalid tenant/lease references
      const { data: invalidLeaseContacts } = await this.supabase
        .from('lease_contacts')
        .select(`
          id, lease_id, tenant_id,
          lease:lease(id),
          tenant:tenants(id)
        `)
        .or('lease.id.is.null,tenant.id.is.null')

      const invalidLeaseContactRows = (invalidLeaseContacts ?? []) as Array<
        Pick<Database['public']['Tables']['lease_contacts']['Row'], 'id'> & {
          lease: { id: number | null } | null
          tenant: { id: string | null } | null
        }
      >;
      invalidLeaseContactRows.forEach((lc) => {
        const missingRefs = []
        if (!lc.lease) missingRefs.push('lease')
        if (!lc.tenant) missingRefs.push('tenant')
        
        result.errors.push(`Lease contact (ID: ${lc.id}) missing ${missingRefs.join(', ')} reference(s)`)
        result.orphanedRecords.push({
          table: 'lease_contacts',
          id: lc.id,
          reason: `Missing ${missingRefs.join(', ')} reference`
        })
      })

    } catch (error) {
      result.errors.push(`Tenant validation failed: ${getErrorMessage(error)}`)
    }
  }

  /**
   * Validate contact data integrity
   */
  private async validateContactRelationships(result: ValidationResult): Promise<void> {
    try {
      // Check for contacts with missing required fields
      const { data: incompleteContacts } = await this.supabase
        .from('contacts')
        .select('id, first_name, last_name, company_name, is_company')
        .or(
          'and(is_company.eq.false,first_name.is.null),and(is_company.eq.false,last_name.is.null),and(is_company.eq.true,company_name.is.null)'
        )

      const incompleteContactRows = (incompleteContacts ?? []) as Array<
        Pick<ContactRow, 'id' | 'first_name' | 'last_name' | 'company_name' | 'is_company'>
      >;
      incompleteContactRows.forEach((contact) => {
        if (contact.is_company && !contact.company_name) {
          result.warnings.push(`Company contact (ID: ${contact.id}) missing company name`)
        } else if (!contact.is_company && (!contact.first_name || !contact.last_name)) {
          result.warnings.push(`Individual contact (ID: ${contact.id}) missing name fields`)
        }
      })

    } catch (error) {
      result.errors.push(`Contact validation failed: ${getErrorMessage(error)}`)
    }
  }

  /**
   * Validate owner relationships
   */
  private async validateOwnerRelationships(result: ValidationResult): Promise<void> {
    try {
      // Check for owners without valid contact references
      const { data: orphanedOwners } = await this.supabase
        .from('owners')
        .select('id, buildium_owner_id, contact_id')
        .not('contact_id', 'in', `(SELECT id FROM contacts)`)

      const orphanedOwnerRows = (orphanedOwners ?? []) as Array<
        Pick<OwnerRow, 'id' | 'buildium_owner_id' | 'contact_id'>
      >;
      orphanedOwnerRows.forEach((owner) => {
        result.errors.push(`Owner (ID: ${owner.id}) references non-existent contact`)
        result.orphanedRecords.push({
          table: 'owners',
          id: owner.id,
          buildiumId: owner.buildium_owner_id,
          reason: 'Invalid contact reference'
        })
      })

      // Check for owners without any property ownerships
      const { data: ownersWithoutProperties } = await this.supabase
        .from('owners')
        .select(`
          id, buildium_owner_id, contact:contacts(display_name),
          ownerships:ownerships(id)
        `)
        .is('ownerships.id', null)

      const ownersWithoutPropertiesRows = (ownersWithoutProperties ?? []) as Array<{
        id: string
        buildium_owner_id: number | null
        contact: { display_name: string | null }[] | null
      }>;
      ownersWithoutPropertiesRows.forEach((owner) => {
        const displayName = owner.contact?.[0]?.display_name ?? 'Unknown'
        result.warnings.push(`Owner "${displayName}" (ID: ${owner.id}) has no property ownerships`)
      })

    } catch (error) {
      result.errors.push(`Owner validation failed: ${getErrorMessage(error)}`)
    }
  }

  /**
   * Validate ownership relationships
   */
  private async validateOwnershipRelationships(result: ValidationResult): Promise<void> {
    try {
      // Check for ownerships with invalid owner/property references
      const { data: invalidOwnerships } = await this.supabase
        .from('ownerships')
        .select('id, owner_id, property_id')
        .or('not.owner_id.in.(SELECT id FROM owners),not.property_id.in.(SELECT id FROM properties)')

      const invalidOwnershipRows = (invalidOwnerships ?? []) as Array<
        Pick<OwnershipRow, 'id' | 'owner_id' | 'property_id'>
      >;
      invalidOwnershipRows.forEach((ownership) => {
        result.errors.push(`Ownership (ID: ${ownership.id}) has invalid owner or property reference`)
        result.orphanedRecords.push({
          table: 'ownerships',
          id: ownership.id,
          reason: 'Invalid owner or property reference'
        })
      })

      // Check for duplicate ownerships (same owner + property)
      const { data: duplicateOwnerships } = await this.supabase
        .rpc('find_duplicate_ownerships')

      ;(duplicateOwnerships as DuplicateOwnership[] | null)?.forEach((duplicate) => {
        result.warnings.push(`Duplicate ownership: Owner ${duplicate.owner_id} owns property ${duplicate.property_id} multiple times`)
      })

    } catch (error) {
      result.errors.push(`Ownership validation failed: ${getErrorMessage(error)}`)
    }
  }

  /**
   * Validate Buildium ID consistency
   */
  private async validateBuildiumIdConsistency(result: ValidationResult): Promise<void> {
    try {
      // Check for duplicate Buildium IDs within each entity type
      const tables = [
        { table: 'properties', buildiumField: 'buildium_property_id' },
        { table: 'units', buildiumField: 'buildium_unit_id' },
        { table: 'lease', buildiumField: 'buildium_lease_id' },
        { table: 'tenants', buildiumField: 'buildium_tenant_id' },
        { table: 'owners', buildiumField: 'buildium_owner_id' }
      ]

      for (const { table, buildiumField } of tables) {
        const { data: duplicates } = await this.supabase
          .rpc('find_duplicate_buildium_ids', {
            table_name: table,
            buildium_field: buildiumField
          })

        ;(duplicates as DuplicateBuildiumId[] | null)?.forEach((duplicate) => {
          result.errors.push(`Duplicate Buildium ID ${duplicate.buildium_id} in ${table}`)
        })
      }

    } catch (error) {
      result.errors.push(`Buildium ID validation failed: ${getErrorMessage(error)}`)
    }
  }

  /**
   * Validate required fields across all entities
   */
  private async validateRequiredFields(result: ValidationResult): Promise<void> {
    try {
      // Properties: name, address_line1, postal_code, country are required
      const { data: incompleteProperties } = await this.supabase
        .from('properties')
        .select('id, name, address_line1, postal_code, country')
        .or('name.is.null,address_line1.is.null,postal_code.is.null,country.is.null')

      const incompletePropertyRows = (incompleteProperties ?? []) as Array<
        Pick<PropertyRow, 'id' | 'name' | 'address_line1' | 'postal_code' | 'country'>
      >;
      incompletePropertyRows.forEach((property) => {
        result.errors.push(`Property (ID: ${property.id}) missing required fields`)
      })

      // Units: property_id, unit_number, address_line1, postal_code, country are required
      const { data: incompleteUnits } = await this.supabase
        .from('units')
        .select('id, property_id, unit_number, address_line1, postal_code, country')
        .or('property_id.is.null,unit_number.is.null,address_line1.is.null,postal_code.is.null,country.is.null')

      const incompleteUnitRows = (incompleteUnits ?? []) as Array<
        Pick<UnitRow, 'id' | 'property_id' | 'unit_number' | 'address_line1' | 'postal_code' | 'country'>
      >;
      incompleteUnitRows.forEach((unit) => {
        result.errors.push(`Unit (ID: ${unit.id}) missing required fields`)
      })

      // Leases: property_id, unit_id, lease_from_date are required
      const { data: incompleteLeases } = await this.supabase
        .from('lease')
        .select('id, property_id, unit_id, lease_from_date')
        .or('property_id.is.null,unit_id.is.null,lease_from_date.is.null')

      const incompleteLeaseRows = (incompleteLeases ?? []) as Array<
        Pick<LeaseRow, 'id' | 'property_id' | 'unit_id' | 'lease_from_date'>
      >;
      incompleteLeaseRows.forEach((lease) => {
        result.errors.push(`Lease (ID: ${lease.id}) missing required fields`)
      })

    } catch (error) {
      result.errors.push(`Required field validation failed: ${getErrorMessage(error)}`)
    }
  }

  /**
   * Auto-fix orphaned records where possible
   */
  async autoFixOrphanedRecords(orphanedRecords: OrphanedRecord[]): Promise<string[]> {
    const fixedRecords: string[] = []

    for (const record of orphanedRecords) {
      try {
        switch (record.reason) {
          case 'Invalid bank account reference':
            // Set operating_bank_gl_account_id to null
            await this.supabase
              .from('properties')
              .update({ operating_bank_gl_account_id: null })
              .eq('id', record.id)
            fixedRecords.push(`Fixed property ${record.id}: removed invalid bank account reference`)
            break

          case 'Invalid property reference':
            // Delete orphaned unit (dangerous - should be manual decision)
            break

          case 'Invalid contact reference':
            // Delete orphaned tenant (dangerous - should be manual decision)
            break

          default:
            // Log for manual review
            console.warn(`Cannot auto-fix record: ${record.table}/${record.id} - ${record.reason}`)
        }
      } catch (error) {
        console.error(`Failed to fix record ${record.table}/${record.id}:`, error)
      }
    }

    return fixedRecords
  }
}

/**
 * Utility function to create and run validation
 */
export async function validateDataIntegrity(supabaseClient: TypedSupabaseClient): Promise<ValidationResult> {
  const validator = new DataIntegrityValidator(supabaseClient)
  return await validator.validateCompleteIntegrity()
}

/**
 * SQL functions needed for validation (add to migration)
 */
export const VALIDATION_SQL_FUNCTIONS = `
-- Find duplicate units within same property
CREATE OR REPLACE FUNCTION find_duplicate_units()
RETURNS TABLE(property_id UUID, unit_number VARCHAR, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT u.property_id, u.unit_number, COUNT(*)::BIGINT
  FROM units u
  GROUP BY u.property_id, u.unit_number
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;

-- Find duplicate Buildium IDs
CREATE OR REPLACE FUNCTION find_duplicate_buildium_ids(table_name TEXT, buildium_field TEXT)
RETURNS TABLE(buildium_id INTEGER, count BIGINT) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT %I::INTEGER, COUNT(*)::BIGINT
    FROM %I
    WHERE %I IS NOT NULL
    GROUP BY %I
    HAVING COUNT(*) > 1
  ', buildium_field, table_name, buildium_field, buildium_field);
END;
$$ LANGUAGE plpgsql;

-- Find duplicate ownerships
CREATE OR REPLACE FUNCTION find_duplicate_ownerships()
RETURNS TABLE(owner_id UUID, property_id UUID, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT o.owner_id, o.property_id, COUNT(*)::BIGINT
  FROM ownerships o
  GROUP BY o.owner_id, o.property_id
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;
`;
