import AddResidentRequestTaskForm from '@/components/tasks/AddResidentRequestTaskForm';
import { supabase, supabaseAdmin } from '@/lib/db';

type Option = { id: string; label: string };

export default async function AddResidentRequestTaskPage() {
  const db = supabaseAdmin || supabase;

  const [{ data: categories }, { data: properties }, { data: staffMembers }] = await Promise.all([
    db
      .from('task_categories')
      .select('id, name')
      .order('name', { ascending: true }),
    db
      .from('properties')
      .select('id, name')
      .order('name', { ascending: true })
      .limit(200),
    db
      .from('staff')
      .select('id, first_name, last_name, email')
      .order('first_name', { ascending: true }),
  ]);

  const categoryOptions: Option[] = (categories || []).map((category) => ({
    id: String(category.id),
    label: category.name || 'Category',
  }));

  const propertyOptions: Option[] = (properties || []).map((property) => ({
    id: String(property.id),
    label: property.name || 'Property',
  }));

  const staffOptions: Option[] = (staffMembers || []).map((staff) => {
    const fullName = [staff.first_name, staff.last_name].filter(Boolean).join(' ').trim();
    return {
      id: String(staff.id),
      label: fullName || staff.email || 'Staff member',
    };
  });

  return (
    <AddResidentRequestTaskForm
      categoryOptions={categoryOptions}
      propertyOptions={propertyOptions}
      staffOptions={staffOptions}
    />
  );
}
