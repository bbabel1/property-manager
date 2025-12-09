import Link from 'next/link'

export default function TasksTab() {
  return (
    <div id="panel-tasks" role="tabpanel" aria-labelledby="tasks">
      <div className="rounded-md border border-border bg-card p-4">
        <h3 className="text-foreground text-base font-semibold">Track tasks for this property</h3>
        <p className="text-muted-foreground text-sm">
          Use the Tasks workspace to create and monitor work tied to this property, including follow-ups and maintenance.
        </p>
        <div className="mt-3 flex gap-3">
          <Link
            href="/tasks"
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            Open Tasks
          </Link>
          <Link
            href="/maintenance"
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            Open Maintenance
          </Link>
        </div>
      </div>
    </div>
  )
}
