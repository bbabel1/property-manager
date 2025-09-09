// Data Integrity Validation System
// Ensures consistency across all entity relationships and Buildium sync operations

import { createClient } from '@supabase/supabase-js'

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  orphanedRecords: OrphanedRecord[]
}

interface OrphanedRecord {
  table: string
  id: string
  buildiumId?: number
  reason: string
}

interface EntityRelationship {
  parentTable: string
  parentId: string
  childTable: string
  childId: string
  relationshipType: 'required' | 'optional'
}

export class DataIntegrityValidator {
  private supabase: any

  constructor(supabaseClient: any) {
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

      propertiesWithoutUnits?.forEach(property => {
        result.warnings.push(`Property "${property.name}" (ID: ${property.id}) has no units`)
      })

      // Check for properties with invalid bank account references
      const { data: propertiesWithInvalidBankAccounts } = await this.supabase
        .from('properties')
        .select(`
          id, name, operating_bank_account_id,
          bank_account:bank_accounts(id)
        `)
        .not('operating_bank_account_id', 'is', null)
        .is('bank_account.id', null)

      propertiesWithInvalidBankAccounts?.forEach(property => {
        result.errors.push(`Property "${property.name}" references non-existent bank account`)
        result.orphanedRecords.push({
          table: 'properties',
          id: property.id,
          buildiumId: property.buildium_property_id,
          reason: 'Invalid bank account reference'
        })
      })

    } catch (error) {
      result.errors.push(`Property validation failed: ${error.message}`)
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

      orphanedUnits?.forEach(unit => {
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

      duplicateUnits?.forEach(duplicate => {
        result.errors.push(`Duplicate unit number "${duplicate.unit_number}" in property ${duplicate.property_id}`)
      })

    } catch (error) {
      result.errors.push(`Unit validation failed: ${error.message}`)
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

      invalidLeases?.forEach(lease => {
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

      leasesWithoutTenants?.forEach(lease => {
        result.warnings.push(`Lease (ID: ${lease.id}) has no associated tenants`)
      })

    } catch (error) {
      result.errors.push(`Lease validation failed: ${error.message}`)
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

      orphanedTenants?.forEach(tenant => {
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

      invalidLeaseContacts?.forEach(lc => {
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
      result.errors.push(`Tenant validation failed: ${error.message}`)
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
          'and(is_company.eq.false,first_name.is.null)',
          'and(is_company.eq.false,last_name.is.null)',
          'and(is_company.eq.true,company_name.is.null)'
        )

      incompleteContacts?.forEach(contact => {
        if (contact.is_company && !contact.company_name) {
          result.warnings.push(`Company contact (ID: ${contact.id}) missing company name`)
        } else if (!contact.is_company && (!contact.first_name || !contact.last_name)) {
          result.warnings.push(`Individual contact (ID: ${contact.id}) missing name fields`)
        }
      })

    } catch (error) {
      result.errors.push(`Contact validation failed: ${error.message}`)
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

      orphanedOwners?.forEach(owner => {
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

      ownersWithoutProperties?.forEach(owner => {
        result.warnings.push(`Owner "${owner.contact?.display_name}" (ID: ${owner.id}) has no property ownerships`)
      })

    } catch (error) {
      result.errors.push(`Owner validation failed: ${error.message}`)
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
        .or(
          `not.owner_id.in.(SELECT id FROM owners)`,
          `not.property_id.in.(SELECT id FROM properties)`
        )

      invalidOwnerships?.forEach(ownership => {
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

      duplicateOwnerships?.forEach(duplicate => {
        result.warnings.push(`Duplicate ownership: Owner ${duplicate.owner_id} owns property ${duplicate.property_id} multiple times`)
      })

    } catch (error) {
      result.errors.push(`Ownership validation failed: ${error.message}`)
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

        duplicates?.forEach(duplicate => {
          result.errors.push(`Duplicate Buildium ID ${duplicate.buildium_id} in ${table}`)
        })
      }

    } catch (error) {
      result.errors.push(`Buildium ID validation failed: ${error.message}`)
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

      incompleteProperties?.forEach(property => {
        result.errors.push(`Property (ID: ${property.id}) missing required fields`)
      })

      // Units: property_id, unit_number, address_line1, postal_code, country are required
      const { data: incompleteUnits } = await this.supabase
        .from('units')
        .select('id, property_id, unit_number, address_line1, postal_code, country')
        .or('property_id.is.null,unit_number.is.null,address_line1.is.null,postal_code.is.null,country.is.null')

      incompleteUnits?.forEach(unit => {
        result.errors.push(`Unit (ID: ${unit.id}) missing required fields`)
      })

      // Leases: property_id, unit_id, lease_from_date are required
      const { data: incompleteLeases } = await this.supabase
        .from('lease')
        .select('id, property_id, unit_id, lease_from_date')
        .or('property_id.is.null,unit_id.is.null,lease_from_date.is.null')

      incompleteLeases?.forEach(lease => {
        result.errors.push(`Lease (ID: ${lease.id}) missing required fields`)
      })

    } catch (error) {
      result.errors.push(`Required field validation failed: ${error.message}`)
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
            // Set operating_bank_account_id to null
            await this.supabase
              .from('properties')
              .update({ operating_bank_account_id: null })
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
export async function validateDataIntegrity(supabaseClient: any): Promise<ValidationResult> {
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
