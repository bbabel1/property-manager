// @ts-nocheck
// Relationship Resolution System
import {
  mapCountryFromBuildium,
  mapLeaseFromBuildium as mapLeaseFromBuildiumMapper,
  mapPropertyFromBuildiumWithBankAccount,
  mapUnitFromBuildium as mapUnitFromBuildiumMapper
} from './buildium-mappers'
import type { TypedSupabaseClient } from './db'
import type {
  BuildiumLease,
  BuildiumOwner,
  BuildiumProperty,
  BuildiumTenant,
  BuildiumTenantAddress,
  BuildiumUnit
} from '@/types/buildium'
// Handles complex entity relationships during Buildium sync operations

interface ResolutionContext {
  supabase: TypedSupabaseClient
  rateLimiter?: unknown
  dryRun?: boolean
}

interface ResolutionResult {
  success: boolean
  localId?: string
  created?: boolean
  error?: string
  dependenciesResolved?: string[]
}

type BuildiumContactPayload = Pick<
  BuildiumTenant,
  'FirstName' | 'LastName' | 'Email' | 'PhoneNumbers' | 'EmergencyContact' | 'Comment' | 'TaxId' | 'SMSOptInStatus'
> & {
  Address?: BuildiumTenantAddress
  PrimaryAddress?: BuildiumTenantAddress
}

type BuildiumOwnerWithContact = BuildiumOwner & { contact?: BuildiumContactPayload }

type ResolverInput = {
  property?: BuildiumProperty
  unit?: BuildiumUnit
  lease?: BuildiumLease
  tenant?: BuildiumTenant
  contact?: BuildiumContactPayload
  owner?: BuildiumOwnerWithContact
}

export class RelationshipResolver {
  private context: ResolutionContext
  private resolvedCache: Map<string, string> = new Map()
  private propertyOrgCache: Map<string, string | null> = new Map()

  constructor(context: ResolutionContext) {
    this.context = context
  }

  /**
   * Resolve complete entity chain: Property → Unit → Lease → Tenant → Contact
   */
  async resolveEntityChain(buildiumData: ResolverInput): Promise<{
    propertyId?: string
    unitId?: string
    leaseId?: string
    tenantId?: string
    contactId?: string
    ownerId?: string
    errors: string[]
  }> {
    const result = {
      propertyId: undefined as string | undefined,
      unitId: undefined as string | undefined,
      leaseId: undefined as string | undefined,
      tenantId: undefined as string | undefined,
      contactId: undefined as string | undefined,
      ownerId: undefined as string | undefined,
      errors: [] as string[]
    }

    try {
      // Step 1: Resolve Property (root of hierarchy)
      if (buildiumData.property) {
        const propertyResult = await this.resolveProperty(buildiumData.property)
        if (propertyResult.success && propertyResult.localId) {
          result.propertyId = propertyResult.localId
        } else {
          result.errors.push(`Failed to resolve property: ${propertyResult.error}`)
          return result // Can't continue without property
        }
      }

      // Step 2: Resolve Unit (requires property)
      if (buildiumData.unit && result.propertyId) {
        const unitResult = await this.resolveUnit(buildiumData.unit, result.propertyId)
        if (unitResult.success && unitResult.localId) {
          result.unitId = unitResult.localId
        } else {
          result.errors.push(`Failed to resolve unit: ${unitResult.error}`)
        }
      }

      // Step 3: Resolve Contact (independent of property chain)
      if (buildiumData.contact || buildiumData.tenant) {
        const contactData = buildiumData.contact || this.extractContactFromTenant(buildiumData.tenant)
        const contactResult = await this.resolveContact(contactData)
        if (contactResult.success && contactResult.localId) {
          result.contactId = contactResult.localId
        } else {
          result.errors.push(`Failed to resolve contact: ${contactResult.error}`)
        }
      }

      // Step 4: Resolve Tenant (requires contact)
      if (buildiumData.tenant && result.contactId) {
        const tenantResult = await this.resolveTenant(buildiumData.tenant, result.contactId)
        if (tenantResult.success && tenantResult.localId) {
          result.tenantId = tenantResult.localId
        } else {
          result.errors.push(`Failed to resolve tenant: ${tenantResult.error}`)
        }
      }

      // Step 5: Resolve Lease (requires property, unit, and optionally tenant)
      if (buildiumData.lease && result.propertyId && result.unitId) {
        const propertyOrgId = await this.getPropertyOrgId(result.propertyId)
        const leaseResult = await this.resolveLease(
          buildiumData.lease, 
          result.propertyId, 
          result.unitId,
          result.tenantId,
          propertyOrgId
        )
        if (leaseResult.success && leaseResult.localId) {
          result.leaseId = leaseResult.localId
        } else {
          result.errors.push(`Failed to resolve lease: ${leaseResult.error}`)
        }
      }

      // Step 6: Resolve Owner (requires contact, can be independent of property chain)
      if (buildiumData.owner) {
        // First resolve owner's contact if not already resolved
        let ownerContactId = result.contactId
        if (!ownerContactId && buildiumData.owner.contact) {
          const ownerContactResult = await this.resolveContact(buildiumData.owner.contact)
          if (ownerContactResult.success && ownerContactResult.localId) {
            ownerContactId = ownerContactResult.localId
          } else {
            result.errors.push(`Failed to resolve owner contact: ${ownerContactResult.error}`)
          }
        }

        if (ownerContactId) {
          const ownerResult = await this.resolveOwner(buildiumData.owner, ownerContactId)
          if (ownerResult.success && ownerResult.localId) {
            result.ownerId = ownerResult.localId

            // Create ownership relationship if property is available
            if (result.propertyId) {
              await this.ensureOwnershipRelationship(result.ownerId, result.propertyId)
            }
          } else {
            result.errors.push(`Failed to resolve owner: ${ownerResult.error}`)
          }
        }
      }

      return result

    } catch (error) {
      result.errors.push(`Entity chain resolution failed: ${(error as Error).message}`)
      return result
    }
  }

  /**
   * Resolve Property entity
   */
  async resolveProperty(buildiumProperty: BuildiumProperty): Promise<ResolutionResult> {
    const cacheKey = `property_${buildiumProperty.Id}`
    if (this.resolvedCache.has(cacheKey)) {
      return { success: true, localId: this.resolvedCache.get(cacheKey), created: false }
    }

    try {
      // Check if property already exists
      const { data: existing, error: searchError } = await this.context.supabase
        .from('properties')
        .select('id')
        .eq('buildium_property_id', buildiumProperty.Id)
        .single()

      if (searchError && searchError.code !== 'PGRST116') {
        return { success: false, error: `Property search failed: ${searchError.message}` }
      }

      if (existing) {
        this.resolvedCache.set(cacheKey, existing.id)
        return { success: true, localId: existing.id, created: false }
      }

      // Create new property if not in dry run mode
      if (this.context.dryRun) {
        return { success: true, localId: 'dry-run-property-id', created: true }
      }

      const propertyData = await mapPropertyFromBuildiumWithBankAccount(buildiumProperty, this.context.supabase)
      const { data: newProperty, error: createError } = await this.context.supabase
        .from('properties')
        .insert(propertyData as any)
        .select('id')
        .single()

      if (createError) {
        return { success: false, error: `Property creation failed: ${createError.message}` }
      }

      this.resolvedCache.set(cacheKey, newProperty.id)
      return { success: true, localId: newProperty.id, created: true }

    } catch (error) {
      return { success: false, error: `Property resolution error: ${(error as Error).message}` }
    }
  }

  /**
   * Resolve Unit entity (requires property)
   */
  async resolveUnit(buildiumUnit: BuildiumUnit, propertyId: string): Promise<ResolutionResult> {
    const cacheKey = `unit_${buildiumUnit.Id}`
    if (this.resolvedCache.has(cacheKey)) {
      return { success: true, localId: this.resolvedCache.get(cacheKey), created: false }
    }

    try {
      // Check if unit already exists
      const { data: existing, error: searchError } = await this.context.supabase
        .from('units')
        .select('id')
        .eq('buildium_unit_id', buildiumUnit.Id)
        .single()

      if (searchError && searchError.code !== 'PGRST116') {
        return { success: false, error: `Unit search failed: ${searchError.message}` }
      }

      if (existing) {
        this.resolvedCache.set(cacheKey, existing.id)
        return { success: true, localId: existing.id, created: false }
      }

      // Create new unit if not in dry run mode
      if (this.context.dryRun) {
        return { success: true, localId: 'dry-run-unit-id', created: true }
      }

      const propertyOrgId = await this.getPropertyOrgId(propertyId)
      if (!propertyOrgId) {
        return { success: false, error: `Property org_id missing for property ${propertyId}` }
      }

      const unitData = this.mapUnitFromBuildium(buildiumUnit, propertyId, propertyOrgId)
      const { data: newUnit, error: createError } = await this.context.supabase
        .from('units')
        .insert(unitData as any)
        .select('id')
        .single()

      if (createError) {
        return { success: false, error: `Unit creation failed: ${createError.message}` }
      }

      this.resolvedCache.set(cacheKey, newUnit.id)
      return { success: true, localId: newUnit.id, created: true }

    } catch (error) {
      return { success: false, error: `Unit resolution error: ${(error as Error).message}` }
    }
  }

  /**
   * Resolve Contact entity
   */
  async resolveContact(contactData: BuildiumContactPayload): Promise<ResolutionResult> {
    if (!contactData) {
      return { success: false, error: 'No contact data provided' }
    }

    try {
      // Try to find existing contact by name/email
      const { data: existing, error: searchError } = await this.context.supabase
        .from('contacts')
        .select('id')
        .or(`and(first_name.eq.${contactData.FirstName},last_name.eq.${contactData.LastName}),primary_email.eq.${contactData.Email}`)
        .single()

      if (searchError && searchError.code !== 'PGRST116') {
        return { success: false, error: `Contact search failed: ${searchError.message}` }
      }

      if (existing) {
        return { success: true, localId: existing.id.toString(), created: false }
      }

      // Create new contact if not in dry run mode
      if (this.context.dryRun) {
        return { success: true, localId: 'dry-run-contact-id', created: true }
      }

      const mappedContactData = this.mapContactFromBuildium(contactData)
      const { data: newContact, error: createError } = await this.context.supabase
        .from('contacts')
        .insert(mappedContactData as any)
        .select('id')
        .single()

      if (createError) {
        return { success: false, error: `Contact creation failed: ${createError.message}` }
      }

      return { success: true, localId: newContact.id.toString(), created: true }

    } catch (error) {
      return { success: false, error: `Contact resolution error: ${(error as Error).message}` }
    }
  }

  /**
   * Resolve Tenant entity (requires contact)
   */
  async resolveTenant(buildiumTenant: BuildiumTenant, contactId: string): Promise<ResolutionResult> {
    const cacheKey = `tenant_${buildiumTenant.Id}`
    if (this.resolvedCache.has(cacheKey)) {
      return { success: true, localId: this.resolvedCache.get(cacheKey), created: false }
    }

    try {
      // Check if tenant already exists
      const { data: existing, error: searchError } = await this.context.supabase
        .from('tenants')
        .select('id')
        .eq('buildium_tenant_id', buildiumTenant.Id)
        .single()

      if (searchError && searchError.code !== 'PGRST116') {
        return { success: false, error: `Tenant search failed: ${searchError.message}` }
      }

      if (existing) {
        this.resolvedCache.set(cacheKey, existing.id)
        return { success: true, localId: existing.id, created: false }
      }

      // Create new tenant if not in dry run mode
      if (this.context.dryRun) {
        return { success: true, localId: 'dry-run-tenant-id', created: true }
      }

      const tenantData = this.mapTenantFromBuildium(buildiumTenant, contactId)
      const { data: newTenant, error: createError } = await this.context.supabase
        .from('tenants')
        .insert(tenantData as any)
        .select('id')
        .single()

      if (createError) {
        return { success: false, error: `Tenant creation failed: ${createError.message}` }
      }

      this.resolvedCache.set(cacheKey, newTenant.id)
      return { success: true, localId: newTenant.id, created: true }

    } catch (error) {
      return { success: false, error: `Tenant resolution error: ${(error as Error).message}` }
    }
  }

  /**
   * Resolve Lease entity (requires property, unit, optionally tenant)
   */
  async resolveLease(
    buildiumLease: BuildiumLease, 
    propertyId: string, 
    unitId: string,
    tenantId?: string,
    orgId?: string | null
  ): Promise<ResolutionResult> {
    const cacheKey = `lease_${buildiumLease.Id}`
    if (this.resolvedCache.has(cacheKey)) {
      return { success: true, localId: this.resolvedCache.get(cacheKey), created: false }
    }

    try {
      // Check if lease already exists
      const { data: existing, error: searchError } = await this.context.supabase
        .from('lease')
        .select('id')
        .eq('buildium_lease_id', buildiumLease.Id)
        .single()

      if (searchError && searchError.code !== 'PGRST116') {
        return { success: false, error: `Lease search failed: ${searchError.message}` }
      }

      if (existing) {
        // If tenant is provided, ensure lease_contact relationship exists
        if (tenantId) {
          await this.ensureLeaseContactRelationship(existing.id.toString(), tenantId)
        }
        
        this.resolvedCache.set(cacheKey, existing.id.toString())
        return { success: true, localId: existing.id.toString(), created: false }
      }

      // Create new lease if not in dry run mode
      if (this.context.dryRun) {
        return { success: true, localId: 'dry-run-lease-id', created: true }
      }

      const leaseOrgId = orgId ?? (await this.getPropertyOrgId(propertyId))
      const leaseData = this.mapLeaseFromBuildium(buildiumLease, propertyId, unitId, leaseOrgId)
      const { data: newLease, error: createError } = await this.context.supabase
        .from('lease')
        .insert(leaseData as any)
        .select('id')
        .single()

      if (createError) {
        return { success: false, error: `Lease creation failed: ${createError.message}` }
      }

      // Create lease_contact relationship if tenant is provided
      if (tenantId) {
        await this.ensureLeaseContactRelationship(newLease.id.toString(), tenantId)
      }

      this.resolvedCache.set(cacheKey, newLease.id.toString())
      return { success: true, localId: newLease.id.toString(), created: true }

    } catch (error) {
      return { success: false, error: `Lease resolution error: ${(error as Error).message}` }
    }
  }

  /**
   * Resolve Owner entity (requires contact)
   */
  async resolveOwner(buildiumOwner: BuildiumOwnerWithContact, contactId: string): Promise<ResolutionResult> {
    const cacheKey = `owner_${buildiumOwner.Id}`
    if (this.resolvedCache.has(cacheKey)) {
      return { success: true, localId: this.resolvedCache.get(cacheKey), created: false }
    }

    try {
      // Check if owner already exists
      const { data: existing, error: searchError } = await this.context.supabase
        .from('owners')
        .select('id')
        .eq('buildium_owner_id', buildiumOwner.Id)
        .single()

      if (searchError && searchError.code !== 'PGRST116') {
        return { success: false, error: `Owner search failed: ${searchError.message}` }
      }

      if (existing) {
        this.resolvedCache.set(cacheKey, existing.id)
        return { success: true, localId: existing.id, created: false }
      }

      // Create new owner if not in dry run mode
      if (this.context.dryRun) {
        return { success: true, localId: 'dry-run-owner-id', created: true }
      }

      const ownerData = this.mapOwnerFromBuildium(buildiumOwner, contactId)
      const { data: newOwner, error: createError } = await this.context.supabase
        .from('owners')
        .insert(ownerData as any)
        .select('id')
        .single()

      if (createError) {
        return { success: false, error: `Owner creation failed: ${createError.message}` }
      }

      this.resolvedCache.set(cacheKey, newOwner.id)
      return { success: true, localId: newOwner.id, created: true }

    } catch (error) {
      return { success: false, error: `Owner resolution error: ${(error as Error).message}` }
    }
  }

  /**
   * Ensure lease_contact relationship exists
   */
  private async ensureLeaseContactRelationship(leaseId: string, tenantId: string): Promise<void> {
    try {
      // Check if relationship already exists
      const { data: existing } = await this.context.supabase
        .from('lease_contacts')
        .select('id')
        .eq('lease_id', leaseId)
        .eq('tenant_id', tenantId)
        .single()

      if (!existing && !this.context.dryRun) {
        // Create relationship
        await this.context.supabase
          .from('lease_contacts')
          .insert({
            lease_id: leaseId,
            tenant_id: tenantId,
            role: 'Tenant',
            status: 'Active',
            is_rent_responsible: true,
            updated_at: new Date().toISOString()
          } as any)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Failed to create lease_contact relationship: ${message}`)
    }
  }

  /**
   * Ensure ownership relationship exists
   */
  private async ensureOwnershipRelationship(ownerId: string, propertyId: string): Promise<void> {
    try {
      // Check if ownership already exists
      const { data: existing } = await this.context.supabase
        .from('ownerships')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('property_id', propertyId)
        .single()

      if (!existing && !this.context.dryRun) {
        // Create ownership relationship
        await this.context.supabase
          .from('ownerships')
          .insert({
            owner_id: ownerId,
            property_id: propertyId,
            ownership_percentage: 100.0, // Default to 100% if not specified
            is_active: true,
            updated_at: new Date().toISOString()
          } as any)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Failed to create ownership relationship: ${message}`)
    }
  }

  /**
   * Resolve org_id for a property (cached)
   */
  private async getPropertyOrgId(propertyId: string): Promise<string | null> {
    if (this.propertyOrgCache.has(propertyId)) {
      return this.propertyOrgCache.get(propertyId) ?? null
    }

    try {
      const { data, error } = await this.context.supabase
        .from('properties')
        .select('org_id')
        .eq('id', propertyId)
        .single()

      if (error) {
        if (error.code !== 'PGRST116') {
          console.warn(`Failed to fetch org for property ${propertyId}: ${error.message}`)
        }
        this.propertyOrgCache.set(propertyId, null)
        return null
      }

      const orgId = (data as { org_id?: string | null } | null)?.org_id ?? null
      this.propertyOrgCache.set(propertyId, orgId)
      return orgId
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Failed to fetch org for property ${propertyId}: ${message}`)
      this.propertyOrgCache.set(propertyId, null)
      return null
    }
  }

  // Mapping functions (simplified versions - use full mappers from buildium-mappers.ts)
  private mapPropertyFromBuildium(buildiumProperty: BuildiumProperty) {
    return {
      name: buildiumProperty.Name,
      buildium_property_id: buildiumProperty.Id,
      address_line1: buildiumProperty.Address?.AddressLine1 || '',
      city: buildiumProperty.Address?.City || '',
      state: buildiumProperty.Address?.State || '',
      postal_code: buildiumProperty.Address?.PostalCode || '',
      country: mapCountryFromBuildium(buildiumProperty.Address?.Country) || 'United States',
      is_active: buildiumProperty.IsActive ?? true,
      updated_at: new Date().toISOString()
    }
  }

  private mapUnitFromBuildium(buildiumUnit: BuildiumUnit, propertyId: string, orgId?: string | null) {
    const base = mapUnitFromBuildiumMapper(buildiumUnit)
    const unitNumberCandidate =
      typeof (buildiumUnit as { Number?: unknown }).Number === 'string'
        ? (buildiumUnit as { Number?: string }).Number
        : base.unit_number
    const unitNumber = unitNumberCandidate ?? buildiumUnit.UnitNumber ?? ''
    const now = new Date().toISOString()

    return {
      ...base,
      buildium_property_id: base.buildium_property_id ?? buildiumUnit.PropertyId,
      property_id: propertyId,
      org_id: orgId ?? undefined,
      unit_number: unitNumber,
      address_line1: base.address_line1 || buildiumUnit.Address?.AddressLine1 || '',
      city: base.city ?? buildiumUnit.Address?.City ?? '',
      state: base.state ?? buildiumUnit.Address?.State ?? '',
      postal_code: base.postal_code || buildiumUnit.Address?.PostalCode || '',
      country: base.country || 'United States',
      market_rent: base.market_rent ?? buildiumUnit.MarketRent ?? null,
      updated_at: now,
      created_at: base.buildium_created_at ?? now
    }
  }

  private mapContactFromBuildium(contactData: BuildiumContactPayload) {
    const phoneNumbers = contactData.PhoneNumbers
    const primaryPhone = Array.isArray(phoneNumbers)
      ? phoneNumbers.find((phone) => typeof phone?.Number === 'string')?.Number
      : phoneNumbers?.Mobile || phoneNumbers?.Home || phoneNumbers?.Work
    return {
      is_company: false,
      first_name: contactData.FirstName,
      last_name: contactData.LastName,
      primary_email: contactData.Email,
      primary_phone: primaryPhone,
      primary_address_line_1: contactData.Address?.AddressLine1,
      primary_city: contactData.Address?.City,
      primary_state: contactData.Address?.State,
      primary_postal_code: contactData.Address?.PostalCode,
      primary_country: mapCountryFromBuildium(contactData.Address?.Country) || 'United States',
      updated_at: new Date().toISOString()
    }
  }

  private mapTenantFromBuildium(buildiumTenant: BuildiumTenant, contactId: string) {
    return {
      contact_id: parseInt(contactId),
      buildium_tenant_id: buildiumTenant.Id,
      emergency_contact_name: buildiumTenant.EmergencyContact?.Name,
      emergency_contact_phone: buildiumTenant.EmergencyContact?.Phone,
      emergency_contact_email: buildiumTenant.EmergencyContact?.Email,
      sms_opt_in_status: buildiumTenant.SMSOptInStatus,
      comment: buildiumTenant.Comment,
      tax_id: buildiumTenant.TaxId,
      updated_at: new Date().toISOString()
    }
  }

  private mapLeaseFromBuildium(
    buildiumLease: BuildiumLease,
    propertyId: string,
    unitId: string,
    orgId?: string | null
  ) {
    const base = mapLeaseFromBuildiumMapper(buildiumLease)
    const now = new Date().toISOString()

    return {
      ...base,
      property_id: propertyId,
      unit_id: unitId,
      org_id: orgId ?? undefined,
      buildium_property_id: base.buildium_property_id ?? buildiumLease.PropertyId,
      buildium_unit_id: base.buildium_unit_id ?? buildiumLease.UnitId,
      unit_number: base.unit_number ?? buildiumLease.UnitNumber ?? null,
      lease_from_date: base.lease_from_date || buildiumLease.LeaseFromDate,
      lease_to_date: base.lease_to_date ?? buildiumLease.LeaseToDate ?? null,
      status: base.status ?? buildiumLease.LeaseStatus ?? 'ACTIVE',
      rent_amount: base.rent_amount ?? buildiumLease.AccountDetails?.Rent ?? null,
      security_deposit: base.security_deposit ?? buildiumLease.AccountDetails?.SecurityDeposit ?? null,
      automatically_move_out_tenants:
        base.automatically_move_out_tenants ?? buildiumLease.AutomaticallyMoveOutTenants ?? null,
      current_number_of_occupants:
        base.current_number_of_occupants ?? buildiumLease.CurrentNumberOfOccupants ?? null,
      renewal_offer_status: base.renewal_offer_status ?? buildiumLease.RenewalOfferStatus ?? null,
      is_eviction_pending: base.is_eviction_pending ?? buildiumLease.IsEvictionPending ?? null,
      payment_due_day: base.payment_due_day ?? buildiumLease.PaymentDueDay ?? null,
      updated_at: now,
      created_at: base.buildium_created_at ?? now
    }
  }

  private mapOwnerFromBuildium(buildiumOwner: BuildiumOwner, contactId: string) {
    return {
      contact_id: parseInt(contactId),
      buildium_owner_id: buildiumOwner.Id,
      management_agreement_start_date: buildiumOwner.ManagementAgreementStartDate,
      management_agreement_end_date: buildiumOwner.ManagementAgreementEndDate,
      tax_id: buildiumOwner.TaxInformation?.TaxPayerId,
      include_in_1099: buildiumOwner.TaxInformation?.IncludeIn1099 || false,
      is_active: buildiumOwner.IsActive ?? true,
      updated_at: new Date().toISOString()
    }
  }

  private extractContactFromTenant(buildiumTenant?: BuildiumTenant): BuildiumContactPayload {
    if (!buildiumTenant) {
      return {} as BuildiumContactPayload
    }
    const legacyAddress =
      'Address' in buildiumTenant
        ? (buildiumTenant as { Address?: BuildiumTenantAddress | null }).Address
        : undefined
    const resolvedAddress = legacyAddress ?? buildiumTenant.PrimaryAddress
    return {
      FirstName: buildiumTenant.FirstName,
      LastName: buildiumTenant.LastName,
      Email: buildiumTenant.Email,
      PhoneNumbers: buildiumTenant.PhoneNumbers,
      Address: resolvedAddress,
      PrimaryAddress: buildiumTenant.PrimaryAddress ?? resolvedAddress
    }
  }
}

/**
 * Utility function for easy relationship resolution
 */
export async function resolveEntityRelationships(
  buildiumData: ResolverInput,
  supabase: TypedSupabaseClient,
  options: { dryRun?: boolean } = {}
) {
  const resolver = new RelationshipResolver({ supabase, dryRun: options.dryRun })
  return await resolver.resolveEntityChain(buildiumData)
}
