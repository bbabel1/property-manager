import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrg } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!hasPermission(auth.roles, 'reports.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get('orgId');
    const format = searchParams.get('format') || 'csv';
    const period = searchParams.get('period') || 'month';

    if (!orgId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'orgId is required' } },
        { status: 400 },
      );
    }

    await requireOrg(orgId);

    // Fetch report data from dashboard API
    const dashboardUrl = new URL(`/api/dashboard/${orgId}/service-metrics`, request.url);
    dashboardUrl.searchParams.set('period', period);
    dashboardUrl.searchParams.set('type', 'all');

    const dashboardResponse = await fetch(dashboardUrl.toString(), {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (!dashboardResponse.ok) {
      throw new Error('Failed to fetch dashboard data');
    }

    const data = await dashboardResponse.json();

    if (format === 'csv') {
      // Generate CSV
      const csvRows: string[] = [];

      // Profitability section
      if (data.data?.profitability?.length > 0) {
        csvRows.push('Service Profitability');
        csvRows.push('Service,Category,Revenue,Costs,Margin,Margin %');
        data.data.profitability.forEach((item: any) => {
          csvRows.push(
            `"${item.offering_name}","${item.category}",${item.revenue_amount},${item.cost_amount},${item.margin_amount},${item.margin_percentage.toFixed(2)}`,
          );
        });
        csvRows.push('');
      }

      // Utilization section
      if (data.data?.utilization?.length > 0) {
        csvRows.push('Service Utilization');
        csvRows.push('Service,Category,Active Properties,Total Properties,Utilization Rate');
        data.data.utilization.forEach((item: any) => {
          csvRows.push(
            `"${item.offering_name}","${item.category}",${item.active_properties},${item.total_properties},${item.utilization_rate.toFixed(2)}`,
          );
        });
      }

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="service-report-${period}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // PDF generation would require a library like pdfkit or puppeteer
      // For now, return JSON with a note
      return NextResponse.json(
        { error: { code: 'NOT_IMPLEMENTED', message: 'PDF export not yet implemented' } },
        { status: 501 },
      );
    }
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/reports/services');
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
