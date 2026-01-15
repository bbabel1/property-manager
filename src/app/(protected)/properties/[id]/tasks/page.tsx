import Link from 'next/link'
import { Body, Heading, Label } from '@/ui/typography'

export default function TasksTab() {
  return (
    <div id="panel-tasks" role="tabpanel" aria-labelledby="tasks">
      <div className="rounded-md border border-border bg-card p-4">
        <Heading as="h3" size="h5">
          Track tasks for this property
        </Heading>
        <Body tone="muted" size="sm">
          Use the Tasks workspace to create and monitor work tied to this property, including follow-ups and maintenance.
        </Body>
        <div className="mt-3 flex gap-3">
          <Label
            as={Link}
            href="/tasks"
            className="text-primary underline-offset-4 hover:underline"
          >
            Open Tasks
          </Label>
          <Label
            as={Link}
            href="/maintenance"
            className="text-primary underline-offset-4 hover:underline"
          >
            Open Maintenance
          </Label>
        </div>
      </div>
    </div>
  )
}
