# Data Integrity Quick Start Guide

<!-- markdownlint-configure-file {"MD013": false} -->

## 🚨 **IMMEDIATE ACTIONS** (2-4 weeks implementation)

### **Week 1: Critical Fixes**

#### **Day 1-2: Run Validation & Assessment**

```bash
# Run the comprehensive validation script
npx tsx scripts/implement-data-integrity-fixes.ts

# This will:
# - Validate all data relationships
# - Test all Buildium API endpoints
# - Recover failed sync operations
# - Generate detailed report
```

#### **Day 3-5: Fix Critical API Endpoints**

Based on the validation report, update any failing critical endpoints:

1. **Properties**: Ensure `/rentals` endpoints are correct
2. **Units**: Verify `/rentals/units` endpoints work
3. **Leases**: Confirm `/leases/{id}` endpoints are accurate
4. **Tenants**: Use `/leases/tenants/{id}` (already fixed)

**Quick Fix Template:**

```typescript
// OLD (if failing)
const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/wrong-endpoint`;

// NEW (correct format)
const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/correct-endpoint`;
```

#### **Day 6-7: Address Data Integrity Errors**

Fix orphaned records and missing relationships identified in the report:

```typescript
// Use the data integrity validator
import { validateDataIntegrity } from '@/lib/data-integrity-validator';

const result = await validateDataIntegrity(supabase);
// Review result.orphanedRecords and fix manually
```

### **Week 2: Implement Core Systems**

#### **Day 1-3: Deploy Relationship Resolver**

```typescript
// Use in your sync operations
import { resolveEntityRelationships } from '@/lib/relationship-resolver';

const result = await resolveEntityRelationships(
  {
    property: buildiumProperty,
    unit: buildiumUnit,
    lease: buildiumLease,
    tenant: buildiumTenant,
  },
  supabase,
);

// Check result.errors for any issues
```

#### **Day 4-5: Set Up Error Recovery**

Note: Failed Buildium sync attempts are persisted in `public.sync_operations` for auditing and retries. Use this table to inspect errors, dependency chains, and retry progress.

```typescript
// Add to your sync processes
import { runSyncRecovery } from '@/lib/sync-error-recovery';

// Run periodically (e.g., every hour)
const recoveryResult = await runSyncRecovery(supabase);
```

#### **Day 6-7: Enable Monitoring**

Set up automated validation checks:

```typescript
// Add to cron job or scheduled function
import { validateDataIntegrity } from '@/lib/data-integrity-validator';

// Run daily
const validation = await validateDataIntegrity(supabase);
if (!validation.isValid) {
  // Send alert to team
  console.error('Data integrity issues detected:', validation.errors);
}
```

### **Week 3-4: Testing & Optimization**

#### **Testing Checklist:**

- [ ] All critical API endpoints return expected responses
- [ ] Property → Unit → Lease → Tenant chain resolves correctly
- [ ] Failed sync operations are automatically recovered
- [ ] Data integrity validation passes
- [ ] No orphaned records remain

#### **Performance Optimization:**

- [ ] API response times < 2 seconds
- [ ] Sync operations complete within expected timeframes
- [ ] Error recovery doesn't create infinite loops
- [ ] Database queries are optimized

## 🔧 **Critical Code Patterns**

### **1. Safe Entity Creation**

```typescript
import { resolveEntityRelationships } from '@/lib/relationship-resolver';

// ALWAYS use relationship resolver for complex entities
async function createLeaseWithTenant(buildiumData) {
  const result = await resolveEntityRelationships(
    {
      property: buildiumData.property,
      unit: buildiumData.unit,
      lease: buildiumData.lease,
      tenant: buildiumData.tenant,
    },
    supabase,
  );

  if (result.errors.length > 0) {
    throw new Error(`Relationship resolution failed: ${result.errors.join('; ')}`);
  }

  return {
    leaseId: result.leaseId,
    tenantId: result.tenantId,
  };
}
```

### **2. API Endpoint Validation**

```typescript
// ALWAYS validate endpoints before production deployment
import { BuildiumEndpointValidator } from '@/lib/buildium-endpoint-validator';

async function validateBeforeDeployment() {
  const validator = new BuildiumEndpointValidator();
  const results = await validator.validateAllEndpoints();

  const criticalFailures = results.filter((r) => r.status === 'FAIL' && r.critical);

  if (criticalFailures.length > 0) {
    throw new Error(
      `Critical API endpoints failing: ${criticalFailures.map((f) => f.endpoint).join(', ')}`,
    );
  }
}
```

### **3. Error Recovery Pattern**

See also: `public.sync_operations` (error tracking and retry log).

```typescript
// ALWAYS wrap sync operations with error recovery
async function syncWithRecovery(operation) {
  try {
    return await performSyncOperation(operation);
  } catch (error) {
    // Log the failed operation for recovery
    await logFailedOperation(operation, error);

    // Attempt immediate recovery if possible
    const recovery = new SyncErrorRecovery(supabase);
    const result = await recovery.recoverSingleOperation(operation);

    if (!result.success) {
      throw new Error(`Sync failed and recovery unsuccessful: ${result.error}`);
    }

    return result;
  }
}
```

### **4. Data Validation Pattern**

```typescript
// ALWAYS validate data integrity after major operations
async function validateAfterSync() {
  const validation = await validateDataIntegrity(supabase);

  if (!validation.isValid) {
    console.error('Data integrity compromised:', validation.errors);

    // Attempt auto-fix for safe issues
    if (validation.orphanedRecords.length > 0) {
      const validator = new DataIntegrityValidator(supabase);
      const fixed = await validator.autoFixOrphanedRecords(validation.orphanedRecords);
      console.log('Auto-fixed records:', fixed);
    }
  }
}
```

## 📊 **Monitoring Dashboard**

### **Key Metrics to Track:**

1. **Data Integrity Score**: Percentage of records with valid relationships
2. **API Endpoint Health**: Success rate of critical endpoints
3. **Sync Success Rate**: Percentage of successful sync operations
4. **Recovery Effectiveness**: Percentage of failed operations successfully recovered

### **Alert Conditions:**

- Data integrity score < 95%
- Any critical API endpoint failure
- Sync success rate < 90%
- More than 10 failed operations in queue

### **Daily Health Check:**

```bash
# Add to your daily monitoring script
npx tsx scripts/implement-data-integrity-fixes.ts > daily-health-report.log 2>&1

# Check for critical issues
if grep -q "CRITICAL" daily-health-report.log; then
  echo "🚨 Critical issues detected - immediate action required"
  # Send alert to team
fi
```

## 🚀 **Success Criteria**

After implementing these fixes, you should achieve:

### **Week 1 Success:**

- [ ] Zero critical API endpoint failures
- [ ] All orphaned records identified and resolved
- [ ] Data integrity validation passes

### **Week 2 Success:**

- [ ] Relationship resolver handles all entity types
- [ ] Error recovery system operational
- [ ] Automated monitoring in place

### **Week 3-4 Success:**

- [ ] 99%+ data integrity score
- [ ] 95%+ sync success rate
- [ ] <1% failed operations requiring manual intervention
- [ ] API response times optimized

### **Long-term Success:**

- [ ] Zero manual data fixes required
- [ ] Automated recovery handles all common failures
- [ ] System scales to 10x current data volume
- [ ] New team members can safely modify sync code

## 🆘 **Emergency Procedures**

### **If Critical API Endpoints Fail:**

1. Check Buildium API status page
2. Verify authentication credentials
3. Test endpoints manually with Postman
4. Update endpoint URLs if Buildium changed them
5. Deploy fixes immediately

### **If Data Integrity Compromised:**

1. Stop all sync operations immediately
2. Run full data integrity validation
3. Identify scope of corruption
4. Restore from backup if necessary
5. Fix root cause before resuming sync

### **If Sync Operations Failing:**

1. Check error recovery logs
2. Identify common failure patterns
3. Increase retry limits temporarily
4. Manual recovery for stuck operations
5. Fix underlying issues causing failures

---

**Remember**: These systems work together. A failure in one area (like API endpoints) will cascade to others (like sync operations). Always fix issues in order of priority: API endpoints → Data integrity → Sync recovery.
