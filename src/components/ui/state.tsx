import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './button';
import { Card, CardContent } from './card';

type StateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function LoadingState(props: Omit<StateProps, 'action'>) {
  const { title, description, icon } = props;
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        {icon ?? <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />}
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function ErrorState(props: StateProps & { actionLabel?: string; onRetry?: () => void }) {
  const { title, description, action, icon, actionLabel, onRetry } = props;
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        {icon ?? <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />}
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ?? (onRetry ? <Button onClick={onRetry}>{actionLabel || 'Try again'}</Button> : null)}
      </CardContent>
    </Card>
  );
}

export function EmptyState(props: StateProps & { action?: ReactNode }) {
  const { title, description, action, icon } = props;
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        {icon ?? <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden="true" />}
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ?? null}
      </CardContent>
    </Card>
  );
}
