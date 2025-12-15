
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { ManagementService } from '@/lib/management-service';
import { toServicePlan } from '@/lib/service-plan';
import { z } from 'zod';

const ServiceConfigSchema = z.object({
  service_plan: z.string().nullable().optional(),
  active_services: z.array(z.string()).nullable().optional(),
  bill_pay_list: z.string().nullable().optional(),
  bill_pay_notes: z.string().nullable().optional(),
});

const QuerySchema = z.object({
  propertyId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
});

// GET /api/management-service/config
// Get management service configuration for a property/unit
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireUser(request);

    const { searchParams } = new URL(request.url);
    const query = QuerySchema.parse({
      propertyId: searchParams.get('propertyId'),
      unitId: searchParams.get('unitId') || undefined,
    });

    const service = new ManagementService(query.propertyId, query.unitId);
    const config = await service.getServiceConfiguration();

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.issues,
        },
        { status: 400 },
      );
    }

    logger.error({ error }, 'Failed to get management service configuration');
    return NextResponse.json(
      {
        error: 'Failed to get management service configuration',
      },
      { status: 500 },
    );
  }
}

// PUT /api/management-service/config
// Update management service configuration for a property/unit
export async function PUT(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireUser(request);

    const { searchParams } = new URL(request.url);
    const query = QuerySchema.parse({
      propertyId: searchParams.get('propertyId'),
      unitId: searchParams.get('unitId') || undefined,
    });

    const body = await request.json();
    const parsed = ServiceConfigSchema.parse(body);
    const config = {
      ...parsed,
      service_plan: toServicePlan(parsed.service_plan),
    };

    const service = new ManagementService(query.propertyId, query.unitId);
    await service.updateServiceConfiguration(config);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.issues,
        },
        { status: 400 },
      );
    }

    logger.error({ error }, 'Failed to update management service configuration');
    return NextResponse.json(
      {
        error: 'Failed to update management service configuration',
      },
      { status: 500 },
    );
  }
}

// GET /api/management-service/units
// Get all units service configurations for a property
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireUser(request);

    const body = await request.json();
    const { propertyId } = z.object({ propertyId: z.string().uuid() }).parse(body);

    const service = new ManagementService(propertyId);
    const unitsConfigs = await service.getUnitsServiceConfigurations();

    return NextResponse.json({ success: true, data: unitsConfigs });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.issues,
        },
        { status: 400 },
      );
    }

    logger.error({ error }, 'Failed to get units service configurations');
    return NextResponse.json(
      {
        error: 'Failed to get units service configurations',
      },
      { status: 500 },
    );
  }
}
