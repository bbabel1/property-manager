// Buildium Edge Function Client
// This client calls the Supabase Edge Functions instead of direct Buildium API

import { supabase } from './db'

export class BuildiumEdgeClient {
  private supabaseUrl: string

  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  }

  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  async syncPropertyToBuildium(propertyData: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: {
          entityType: 'property',
          entityData: propertyData,
          operation: propertyData.buildium_property_id ? 'update' : 'create'
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { 
          success: true, 
          buildiumId: data.data?.Id || propertyData.buildium_property_id 
        }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to sync property via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async syncOwnerToBuildium(ownerData: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: {
          entityType: 'owner',
          entityData: ownerData,
          operation: ownerData.buildium_owner_id ? 'update' : 'create'
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { 
          success: true, 
          buildiumId: data.data?.Id || ownerData.buildium_owner_id 
        }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to sync owner via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getPropertyFromBuildium(propertyId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: {
          method: 'GET',
          entityType: 'property',
          entityId: propertyId
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get property via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getOwnerFromBuildium(ownerId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: {
          method: 'GET',
          entityType: 'owner',
          entityId: ownerId
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get owner via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // SYNC STATUS OPERATIONS
  // ============================================================================

  async getSyncStatus(entityType: string, entityId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: {
          method: 'GET',
          entityType,
          entityId
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get sync status via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getFailedSyncs(entityType?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: {
          method: 'GET',
          entityType
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get failed syncs via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async retryFailedSyncs(entityType?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: {
          method: 'POST',
          entityType
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to retry failed syncs via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // BANK ACCOUNT OPERATIONS
  // ============================================================================

  async syncBankAccountsFromBuildium(options: { forceSync?: boolean } = {}): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: {
          entityType: 'bankAccount',
          operation: 'syncFromBuildium',
          options
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to sync bank accounts via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async syncBankAccountToBuildium(bankAccountData: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: {
          entityType: 'bankAccount',
          entityData: bankAccountData,
          operation: bankAccountData.buildium_bank_id ? 'update' : 'create'
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { 
          success: true, 
          buildiumId: data.data?.Id || bankAccountData.buildium_bank_id 
        }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to sync bank account via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getBankAccountFromBuildium(bankAccountId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: {
          method: 'GET',
          entityType: 'bankAccount',
          entityId: bankAccountId
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get bank account via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getBankAccountSyncStatus(bankAccountId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: {
          method: 'GET',
          entityType: 'bankAccount',
          entityId: bankAccountId
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get bank account sync status via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getAllBankAccountSyncStatuses(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: {
          method: 'GET',
          entityType: 'bankAccount'
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get all bank account sync statuses via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }
}

// Export singleton instance
export const buildiumEdgeClient = new BuildiumEdgeClient()
