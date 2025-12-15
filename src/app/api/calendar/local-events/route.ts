/**
 * Local Events API
 * 
 * GET /api/calendar/local-events
 * Get local events from Tasks, Work Orders, Transactions, and Leases
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';

interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime in UTC
  end: string | null; // ISO datetime in UTC
  allDay: boolean;
  source: 'task' | 'work_order' | 'transaction' | 'lease';
  sourceId: string;
  color: string;
  description?: string;
  location?: string;
  timezone?: string;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();

    // Get user's org_id from org_memberships
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: { code: 'ORG_NOT_FOUND', message: 'Organization membership not found' } },
        { status: 403 }
      );
    }

    const orgId = membership.org_id;

    // Get query parameters
    const url = new URL(request.url);
    const timeMin = url.searchParams.get('timeMin');
    const timeMax = url.searchParams.get('timeMax');
    const typesParam = url.searchParams.get('types') || 'tasks,work_orders,transactions,leases';
    const types = typesParam.split(',').map(t => t.trim());

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: { code: 'INVALID_PARAMS', message: 'timeMin and timeMax are required' } },
        { status: 400 }
      );
    }

    const events: CalendarEvent[] = [];

    // Fetch Tasks
    if (types.includes('tasks')) {
      const { data: tasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('id, subject, description, scheduled_date, property_id')
        .eq('org_id', orgId)
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', timeMin)
        .lte('scheduled_date', timeMax);

      if (!tasksError && Array.isArray(tasks)) {
        for (const task of tasks as Array<{ id: string; subject: string; description?: string | null; scheduled_date: string | null }>) {
          if (!task.scheduled_date) continue;
          const start = new Date(task.scheduled_date);
          const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
          
          events.push({
            id: `task-${task.id}`,
            title: task.subject,
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: false,
            source: 'task',
            sourceId: task.id,
            color: '#3b82f6', // blue
            description: task.description || undefined,
          });
        }
      }
    }

    // Fetch Work Orders
    if (types.includes('work_orders')) {
      const { data: workOrders, error: workOrdersError } = await supabaseAdmin
        .from('work_orders')
        .select('id, subject, description, scheduled_date, property_id')
        .eq('org_id', orgId)
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', timeMin)
        .lte('scheduled_date', timeMax);

      if (!workOrdersError && Array.isArray(workOrders)) {
        for (const wo of workOrders as Array<{ id: string; subject: string; description?: string | null; scheduled_date: string | null }>) {
          if (!wo.scheduled_date) continue;
          const start = new Date(wo.scheduled_date);
          const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // +2 hours
          
          events.push({
            id: `work_order-${wo.id}`,
            title: wo.subject,
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: false,
            source: 'work_order',
            sourceId: wo.id,
            color: '#f97316', // orange
            description: wo.description || undefined,
          });
        }
      }
    }

    // Fetch Transactions (bills with due dates)
    if (types.includes('transactions')) {
      const timeMinDate = timeMin.split('T')[0]
      const timeMaxDate = timeMax.split('T')[0]
      
      const { data: transactions, error: transactionsError } = await supabaseAdmin
        .from('transactions')
        .select('id, memo, due_date, total_amount, org_id')
        .eq('org_id', orgId)
        .not('due_date', 'is', null)
        .gte('due_date', timeMinDate)
        .lte('due_date', timeMaxDate);

      if (!transactionsError && Array.isArray(transactions)) {
        for (const tx of transactions as Array<{ id: string | number; due_date: string | null; memo?: string | null; total_amount?: number | null }>) {
          if (!tx.due_date) continue;
          const start = new Date(`${tx.due_date}T00:00:00Z`);
          const end = new Date(start);
          
          events.push({
            id: `transaction-${tx.id}`,
            title: tx.memo || `Bill due: $${tx.total_amount || 0}`,
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: true,
            source: 'transaction',
            sourceId: String(tx.id),
            color: '#10b981', // green
            description: tx.total_amount ? `Amount: $${tx.total_amount}` : undefined,
          });
        }
      }
    }

    // Fetch Leases
    if (types.includes('leases')) {
      const { data: leases, error: leasesError } = await supabaseAdmin
        .from('lease')
        .select('id, lease_from_date, lease_to_date, unit_id')
        .not('lease_to_date', 'is', null)
        .lte('lease_from_date', timeMax)
        .gte('lease_to_date', timeMin);

      if (!leasesError && Array.isArray(leases)) {
        for (const lease of leases as Array<{ id: string | number; lease_from_date: string; lease_to_date: string; unit_id?: string | null }>) {
          if (!lease.lease_from_date || !lease.lease_to_date) continue;
          const start = new Date(lease.lease_from_date);
          start.setUTCHours(0, 0, 0, 0);
          const end = new Date(lease.lease_to_date);
          end.setUTCHours(23, 59, 59, 999);
          
          events.push({
            id: `lease-${lease.id}`,
            title: `Lease${lease.unit_id ? ` - Unit ${lease.unit_id}` : ''}`,
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: true,
            source: 'lease',
            sourceId: lease.id.toString(),
            color: '#8b5cf6', // purple
          });
        }
      }
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching local events:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch local events' } },
      { status: 500 }
    );
  }
}
