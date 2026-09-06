'use client';

import { useState } from 'react';
import { Users, Quote, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { SeverityBadge, RiskTypeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export interface RiskCardData {
  id: string;
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  confidence: number;
  title: string;
  description: string;
  project: string | null;
  status: 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'IGNORED';
  affectedPeople: string[];
  evidence: { id: string; quote: string; sourceUserName?: string | null }[];
  recommendations: { id: string; text: string }[];
}

const STATUS_LABEL: Record<RiskCardData['status'], string> = {
  NEW: 'New',
  INVESTIGATING: 'Investigating',
  RESOLVED: 'Resolved',
  IGNORED: 'Ignored',
};

export function RiskCard({
  risk,
  onStatusChange,
  onCreateTask,
}: {
  risk: RiskCardData;
  onStatusChange?: (id: string, status: RiskCardData['status']) => void;
  onCreateTask?: (id: string, recommendationId?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="animate-fade-in overflow-hidden transition-shadow hover:shadow-md">
      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={risk.severity} />
          <RiskTypeBadge type={risk.type} />
          {risk.project && (
            <span className="text-xs font-medium text-muted-foreground">· {risk.project}</span>
          )}
          <div className="ml-auto">
            <StatusSelect status={risk.status} onChange={(s) => onStatusChange?.(risk.id, s)} />
          </div>
        </div>

        <h3 className="mb-1 text-base font-semibold leading-snug">{risk.title}</h3>
        <p className="text-sm text-muted-foreground">{risk.description}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ConfidenceMeter confidence={risk.confidence} />
            {risk.affectedPeople.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {risk.affectedPeople.slice(0, 3).join(', ')}
                {risk.affectedPeople.length > 3 && ` +${risk.affectedPeople.length - 3}`}
              </div>
            )}
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? 'Hide details' : 'View evidence'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            {risk.evidence.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signals</p>
                <ul className="space-y-2">
                  {risk.evidence.map((e) => (
                    <li key={e.id} className="flex gap-2 rounded-lg bg-muted p-2.5 text-sm">
                      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {e.sourceUserName && <span className="font-medium">{e.sourceUserName}: </span>}
                        &ldquo;{e.quote}&rdquo;
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {risk.recommendations.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recommended actions
                </p>
                <ul className="space-y-2">
                  {risk.recommendations.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">
                      <span>{r.text}</span>
                      <Button size="sm" variant="outline" onClick={() => onCreateTask?.(risk.id, r.id)}>
                        <Plus className="h-3.5 w-3.5" />
                        Create task
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', pct >= 70 ? 'bg-primary' : pct >= 40 ? 'bg-medium' : 'bg-muted-foreground')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{pct}% confidence</span>
    </div>
  );
}

function StatusSelect({
  status,
  onChange,
}: {
  status: RiskCardData['status'];
  onChange: (s: RiskCardData['status']) => void;
}) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as RiskCardData['status'])}
      className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {(Object.keys(STATUS_LABEL) as RiskCardData['status'][]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
