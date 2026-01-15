import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Body, Heading } from '@/ui/typography';
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
          <Heading as="p" size="h6" className="text-foreground">
            {title}
          </Heading>
          {description ? (
            <Body as="p" size="sm" tone="muted">
              {description}
            </Body>
          ) : null}
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
          <Heading as="h3" size="h4" className="text-foreground">
            {title}
          </Heading>
          {description ? (
            <Body as="p" size="sm" tone="muted">
              {description}
            </Body>
          ) : null}
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
          <Heading as="h3" size="h4" className="text-foreground">
            {title}
          </Heading>
          {description ? (
            <Body as="p" size="sm" tone="muted">
              {description}
            </Body>
          ) : null}
        </div>
        {action ?? null}
      </CardContent>
    </Card>
  );
}
