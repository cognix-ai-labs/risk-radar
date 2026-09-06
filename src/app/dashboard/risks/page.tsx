'use client';

import { useState } from 'react';
import { Play, ShieldCheck } from 'lucide-react';
import { Topbar } from '@/components/dashboard/topbar';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState, SkeletonCard } from '@/components/ui/states';
import { RiskCard, type RiskCardData } from '@/components/dashboard/risk-card';
import { useFetch } from '@/lib/hooks/useFetch';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { cn } from '@/lib/utils/cn';

const STATUS_FILTERS = ['ALL', 'NEW', 'INVESTIGATING', 'RESOLVED', 'IGNORED'] as const;

export default function RisksPage() {
  const { workspace } = useCurrentWorkspace();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const query = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
  const { data, error, loading, refetch } = useFetch<{ risks: RawRisk[] }>(
    workspace ? `/api/workspaces/${workspace.id}/risks${query}` : null,
    [workspace?.id, statusFilter]
  );

  async function runAnalysis() {
    if (!workspace) return;
    setTriggering(true);
    setTriggerError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/analysis`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to start analysis');
      // Poll a couple of times for the async worker to finish, then refresh.
      setTimeout(refetch, 4000);
      setTimeout(refetch, 9000);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : 'Failed to start analysis');
    } finally {
      setTriggering(false);
    }
  }

  async function updateStatus(riskId: string, status: RiskCardData['status']) {
    if (!workspace) return;
    await fetch(`/api/workspaces/${workspace.id}/risks/${riskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    refetch();
  }

  async function createTask(riskId: string, recommendationId?: string) {
    if (!workspace) return;
    await fetch(`/api/workspaces/${workspace.id}/risks/${riskId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendationId }),
    });
  }

  return (
    <>
      <Topbar title="Risks" />
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  statusFilter === s ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <Button onClick={runAnalysis} disabled={triggering || !workspace}>
            <Play className="h-4 w-4" />
            {triggering ? 'Starting…' : 'Run analysis'}
          </Button>
        </div>

        {triggerError && <ErrorState description={triggerError} />}

        {loading && (
          <div className="grid gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {error && <ErrorState description={error} action={<Button onClick={refetch}>Retry</Button>} />}

        {data && data.risks.length === 0 && (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No risks found"
            description="Either everything looks healthy, or an analysis hasn't run yet — click Run analysis to check your connected channels."
          />
        )}

        {data && data.risks.length > 0 && (
          <div className="grid gap-4">
            {data.risks.map((r) => (
              <RiskCard key={r.id} risk={toCardData(r)} onStatusChange={updateStatus} onCreateTask={createTask} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

interface RawRisk {
  id: string;
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  confidence: number;
  title: string;
  description: string;
  status: RiskCardData['status'];
  affectedPeople: string[];
  project: { name: string } | null;
  evidence: { id: string; quote: string; sourceUserName: string | null }[];
  recommendations: { id: string; text: string }[];
}

function toCardData(r: RawRisk): RiskCardData {
  return {
    id: r.id,
    type: r.type,
    severity: r.severity,
    confidence: r.confidence,
    title: r.title,
    description: r.description,
    project: r.project?.name ?? null,
    status: r.status,
    affectedPeople: r.affectedPeople,
    evidence: r.evidence,
    recommendations: r.recommendations,
  };
}
