import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isNewServiceCatalogEnabled } from './service-compatibility';
import {
  getPropertyServicePricing,
  type BillingBasis,
  type BillingFrequency,
  type BillOn,
  type RentBasis,
  type ServicePricingConfig,
} from './service-pricing';
import { type ServicePlan, toServicePlan } from './service-plan';
export type { ServicePricingConfig, ServicePricingPreview } from './service-pricing';

export interface ManagementServiceConfig {
  service_plan: ServicePlan | null;
  active_services: string[] | null;
  bill_pay_list: string | null;
  bill_pay_notes: string | null;
  source: 'property' | 'unit';
  unit_id?: string;
  // New fields for service catalog integration
  service_offerings?: ServiceOffering[];
  pricing_config?: ServicePricingConfig[];
  plan_defaults?: PlanDefaults;
}

export interface ServiceOffering {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  billing_basis: BillingBasis;
  default_rate: number | null;
  default_freq: BillingFrequency | string;
  min_amount: number | null;
  max_amount: number | null;
  default_rent_basis?: RentBasis | null;
  applies_to: string;
  bill_on: BillOn;
  is_active: boolean;
}

export interface PlanDefaults {
  plan_fee_percent: number | null;
  min_monthly_fee: number | null;
  included_offerings: string[];
  required_offerings: string[];
}

export interface PropertyServiceData {
  service_plan: ServicePlan | null;
  active_services: string[] | null;
  service_assignment: 'Property Level' | 'Unit Level' | null;
  bill_pay_list: string | null;
  bill_pay_notes: string | null;
}

export interface UnitServiceData {
  service_plan: ServicePlan | null;
  active_services: string | null;
  fee_notes: string | null;
  bill_pay_list: string | null;
  bill_pay_notes: string | null;
}

/**
 * Management Service Configuration Handler
 *
 * Handles conditional logic for service assignment based on property-level vs unit-level configuration.
 * If service_assignment is "Property Level", fetches service data from properties table.
 * If service_assignment is "Unit Level", fetches service data from units table.
 */
export class ManagementService {
  private propertyId: string;
  private unitId?: string;

  constructor(propertyId: string, unitId?: string) {
    this.propertyId = propertyId;
    this.unitId = unitId;
  }

  /**
   * Get management service configuration based on service assignment level
   * Supports both legacy and new service catalog via feature flag
   */
  async getServiceConfiguration(): Promise<ManagementServiceConfig> {
    try {
      // First, get the property's service assignment level
      const propertyServiceData = await this.getPropertyServiceData();

      let config: ManagementServiceConfig;

      if (propertyServiceData.service_assignment === 'Property Level') {
        config = await this.getPropertyLevelConfiguration(propertyServiceData);
      } else if (propertyServiceData.service_assignment === 'Unit Level') {
        config = await this.getUnitLevelConfiguration();
      } else {
        // Default to property level if service_assignment is null or undefined
        logger.warn(
          `Property ${this.propertyId} has no service_assignment set, defaulting to property level`,
        );
        config = await this.getPropertyLevelConfiguration(propertyServiceData);
      }

      // If new service catalog is enabled, enrich with service offerings and pricing
      if (isNewServiceCatalogEnabled()) {
        await this.enrichWithServiceCatalog(config);
      }

      return config;
    } catch (error) {
      logger.error(
        { error, propertyId: this.propertyId, unitId: this.unitId },
        'Failed to get management service configuration',
      );
      throw new Error(
        `Failed to get management service configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Enrich configuration with service catalog data (when feature flag is enabled)
   */
  private async enrichWithServiceCatalog(config: ManagementServiceConfig): Promise<void> {
    try {
      // Fetch service offerings from catalog
      const { data: offerings, error: offeringsError } = await supabaseAdmin
        .from('service_offerings')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (offeringsError) {
        logger.warn(
          { error: offeringsError },
          'Failed to fetch service offerings, continuing without enrichment',
        );
        return;
      }

      config.service_offerings = (offerings || []) as ServiceOffering[];

      // Fetch plan-based inclusions if service plan is set
      const plan = config.service_plan;
      if (plan) {
        const { data: planOfferings } = await supabaseAdmin
          .from('service_plan_offerings')
          .select('offering_id, is_included, is_optional, service_offerings(*)')
          .eq('service_plan', plan)
          .eq('is_included', true);

        if (planOfferings) {
          config.service_offerings = planOfferings
            .map((po) => {
              const offering = po.service_offerings;
              return offering && typeof offering === 'object'
                ? (offering as unknown as ServiceOffering)
                : null;
            })
            .filter((o): o is ServiceOffering => o !== null);
        }

        // Fetch plan defaults
        const { data: planDefaults } = await supabaseAdmin
          .from('service_plan_default_pricing')
          .select('plan_fee_percent, min_monthly_fee, offering_id, is_required')
          .eq('service_plan', plan)
          .limit(1)
          .maybeSingle();

        if (planDefaults) {
          config.plan_defaults = {
            plan_fee_percent: planDefaults.plan_fee_percent,
            min_monthly_fee: planDefaults.min_monthly_fee,
            included_offerings: [],
            required_offerings: [],
          };
        }
      }

      // For Custom plan or A-la-Carte, fetch active offerings from property_service_pricing
      if (config.service_plan === 'Custom' || config.service_plan === 'A-la-carte') {
        try {
          const pricingConfig = await getPropertyServicePricing(
            this.propertyId,
            this.unitId || null,
          );
          config.pricing_config = pricingConfig;
        } catch (error) {
          logger.warn({ error }, 'Failed to fetch property service pricing');
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Error enriching with service catalog, continuing without enrichment');
    }
  }

  /**
   * Get service data from properties table
   */
  private async getPropertyServiceData(): Promise<PropertyServiceData> {
    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('service_plan, active_services, service_assignment, bill_pay_list, bill_pay_notes')
      .eq('id', this.propertyId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch property service data: ${error.message}`);
    }

    return {
      service_plan: data.service_plan,
      active_services: data.active_services,
      service_assignment: data.service_assignment,
      bill_pay_list: data.bill_pay_list,
      bill_pay_notes: data.bill_pay_notes,
    };
  }

  /**
   * Get service configuration for property-level assignment
   */
  private async getPropertyLevelConfiguration(
    propertyData: PropertyServiceData,
  ): Promise<ManagementServiceConfig> {
    return {
      service_plan: propertyData.service_plan,
      active_services: propertyData.active_services,
      bill_pay_list: propertyData.bill_pay_list,
      bill_pay_notes: propertyData.bill_pay_notes,
      source: 'property',
    };
  }

  /**
   * Get service configuration for unit-level assignment
   */
  private async getUnitLevelConfiguration(): Promise<ManagementServiceConfig> {
    if (!this.unitId) {
      throw new Error('Unit ID is required for unit-level service configuration');
    }

    const { data, error } = await supabaseAdmin
      .from('units')
      .select('service_plan, active_services, fee_notes, bill_pay_list, bill_pay_notes')
      .eq('id', this.unitId)
      .eq('property_id', this.propertyId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch unit service data: ${error.message}`);
    }

    // Parse active_services from text field
    let activeServicesArray: string[] | null = null;
    if (data.active_services) {
      try {
        // Try to parse as JSON array first
        activeServicesArray = JSON.parse(data.active_services);
      } catch {
        // If not JSON, treat as comma-separated string
        activeServicesArray = data.active_services
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
      }
    }

    return {
      service_plan: data.service_plan,
      active_services: activeServicesArray,
      bill_pay_list: data.bill_pay_list,
      bill_pay_notes: data.bill_pay_notes ?? data.fee_notes,
      source: 'unit',
      unit_id: this.unitId,
    };
  }

  /**
   * Update service configuration based on assignment level
   */
  async updateServiceConfiguration(config: Partial<ManagementServiceConfig>): Promise<void> {
    try {
      const currentConfig = await this.getServiceConfiguration();

      if (currentConfig.source === 'property') {
        await this.updatePropertyLevelConfiguration(config);
      } else {
        await this.updateUnitLevelConfiguration(config);
      }
    } catch (error) {
      logger.error(
        { error, propertyId: this.propertyId, unitId: this.unitId },
        'Failed to update management service configuration',
      );
      throw new Error(
        `Failed to update management service configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Update property-level service configuration
   */
  private async updatePropertyLevelConfiguration(
    config: Partial<ManagementServiceConfig>,
  ): Promise<void> {
    const updateData: Record<string, unknown> = {};

    if (config.service_plan !== undefined) {
      updateData.service_plan = config.service_plan;
    }

    if (config.active_services !== undefined) {
      updateData.active_services = config.active_services;
    }

    if (config.bill_pay_list !== undefined) {
      updateData.bill_pay_list = config.bill_pay_list;
    }

    if (config.bill_pay_notes !== undefined) {
      updateData.bill_pay_notes = config.bill_pay_notes;
    }

    const { error } = await supabaseAdmin
      .from('properties')
      .update(updateData)
      .eq('id', this.propertyId);

    if (error) {
      throw new Error(`Failed to update property service configuration: ${error.message}`);
    }
  }

  /**
   * Update unit-level service configuration
   */
  private async updateUnitLevelConfiguration(
    config: Partial<ManagementServiceConfig>,
  ): Promise<void> {
    if (!this.unitId) {
      throw new Error('Unit ID is required for unit-level service configuration updates');
    }

    const updateData: Record<string, unknown> = {};

    if (config.service_plan !== undefined) {
      updateData.service_plan = config.service_plan;
    }

    if (config.active_services !== undefined) {
      // Convert array to text format for units table
      updateData.active_services = config.active_services
        ? JSON.stringify(config.active_services)
        : null;
    }

    if (config.bill_pay_list !== undefined) {
      updateData.bill_pay_list = config.bill_pay_list;
    }

    if (config.bill_pay_notes !== undefined) {
      updateData.bill_pay_notes = config.bill_pay_notes;
      updateData.fee_notes = config.bill_pay_notes;
    }

    const { error } = await supabaseAdmin
      .from('units')
      .update(updateData)
      .eq('id', this.unitId)
      .eq('property_id', this.propertyId);

    if (error) {
      throw new Error(`Failed to update unit service configuration: ${error.message}`);
    }
  }

  /**
   * Get all units for a property with their service configurations
   */
  async getUnitsServiceConfigurations(): Promise<
    Array<ManagementServiceConfig & { unit_number: string }>
  > {
    try {
      const { data, error } = await supabaseAdmin
        .from('units')
        .select(
          'id, unit_number, service_plan, active_services, fee_notes, bill_pay_list, bill_pay_notes',
        )
        .eq('property_id', this.propertyId)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to fetch units service configurations: ${error.message}`);
      }

      return data.map((unit) => {
        let activeServicesArray: string[] | null = null;
        if (unit.active_services) {
          try {
            activeServicesArray = JSON.parse(unit.active_services);
          } catch {
            activeServicesArray = unit.active_services
              .split(',')
              .map((s: string) => s.trim())
              .filter((s: string) => s.length > 0);
          }
        }

        return {
          service_plan: unit.service_plan,
          active_services: activeServicesArray,
          bill_pay_list: unit.bill_pay_list,
          bill_pay_notes: unit.bill_pay_notes ?? unit.fee_notes,
          source: 'unit' as const,
          unit_id: unit.id,
          unit_number: unit.unit_number,
        };
      });
    } catch (error) {
      logger.error(
        { error, propertyId: this.propertyId },
        'Failed to get units service configurations',
      );
      throw new Error(
        `Failed to get units service configurations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

/**
 * Factory function to create ManagementService instance
 */
export function createManagementService(propertyId: string, unitId?: string): ManagementService {
  return new ManagementService(propertyId, unitId);
}

/**
 * Utility function to get service configuration for a property
 */
export async function getPropertyServiceConfiguration(
  propertyId: string,
  unitId?: string,
): Promise<ManagementServiceConfig> {
  const service = createManagementService(propertyId, unitId);
  return await service.getServiceConfiguration();
}

/**
 * Utility function to update service configuration for a property
 */
export async function updatePropertyServiceConfiguration(
  propertyId: string,
  config: Partial<ManagementServiceConfig>,
  unitId?: string,
): Promise<void> {
  const service = createManagementService(propertyId, unitId);
  await service.updateServiceConfiguration(config);
}

/**
 * Get service pricing configuration for a property/unit
 * Part of Phase 3.2: Service Configuration Integration
 */
export async function getServicePricing(
  propertyId: string,
  unitId?: string | null,
  effectiveDate?: string,
): Promise<ServicePricingConfig[]> {
  return getPropertyServicePricing(propertyId, unitId, effectiveDate, supabaseAdmin);
}
