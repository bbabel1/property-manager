import ManageTaskCategoriesForm from '@/components/tasks/ManageTaskCategoriesForm';
import { supabase, supabaseAdmin } from '@/lib/db';

type CategoryRecord = {
  id: string;
  name: string;
  taskCount: number;
};

export default async function ManageTaskCategoriesPage() {
  const db = supabaseAdmin || supabase;

  const [{ data: categoriesData }, { data: tasksData }] = await Promise.all([
    db.from('task_categories').select('id, name').order('name', { ascending: true }),
    db.from('tasks').select('task_category_id'),
  ]);

  const taskCounts = new Map<string, number>();
  for (const task of tasksData || []) {
    const key = task.task_category_id ? String(task.task_category_id) : '';
    taskCounts.set(key, (taskCounts.get(key) ?? 0) + 1);
  }

  const categories: CategoryRecord[] = (categoriesData || []).map((category) => ({
    id: String(category.id),
    name: category.name || 'Category',
    taskCount: taskCounts.get(String(category.id)) ?? 0,
  }));

  return <ManageTaskCategoriesForm categories={categories} unassignedCount={taskCounts.get('') ?? 0} />;
}
