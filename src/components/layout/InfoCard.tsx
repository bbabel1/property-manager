import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function InfoCard({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  )
}

