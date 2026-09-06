import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  Critical: 'bg-critical/10 text-critical border-critical/20',
  High: 'bg-high/10 text-high border-high/20',
  Medium: 'bg-medium/10 text-medium border-medium/20',
  Low: 'bg-low/10 text-low border-low/20',
};

export function SeverityBadge({ severity }: { severity: 'Critical' | 'High' | 'Medium' | 'Low' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        SEVERITY_STYLES[severity]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}

const TYPE_LABELS: Record<string, string> = {
  blocker: 'Blocker',
  dependency: 'Dependency',
  deadline_risk: 'Deadline Risk',
  ghost_work: 'Ghost Work',
  decision_drift: 'Decision Drift',
  customer_issue: 'Customer Issue',
  resource_risk: 'Resource Risk',
};

export function RiskTypeBadge({ type }: { type: string }) {
  return <Badge>{TYPE_LABELS[type] ?? type}</Badge>;
}
