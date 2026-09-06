'use client';

import Link from 'next/link';
import { AlertOctagon, AlertTriangle, Ban, Ghost, GitBranch, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { Topbar } from '@/components/dashboard/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useFetch } from '@/lib/hooks/useFetch';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { cn } from '@/lib/utils/cn';

interface Overview {
  healthScore: number;
  critical: number;
  high: number;
  blockers: number;
  ghostWork: number;
  decisionDrift: number;
  totalOpenRisks: number;
  projects: { id: string; name: string; trend: 'IMPROVING' | 'STABLE' | 'INCREASING' }[];
  recentInsights: { id: string; type: string; severity: string; title: string; project: string | null }[];
}

export default function DashboardOverviewPage() {
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();
  const { data, error, loading, refetch } = useFetch<Overview>(
    workspace ? `/api/workspaces/${workspace.id}/overview` : null,
    [workspace?.id]
  );

  if (workspaceLoading) return <LoadingState label="Loading your workspace…" />;

  if (!workspace) {
    return (
      <>
        <Topbar title="Overview" />
        <div className="p-6">
          <EmptyState
            title="No workspace yet"
            description="Something went wrong setting up your workspace. Try signing out and back in."
          />
        </div>
      </>
    );
  }

  // Show the connect-Slack CTA only for a genuinely fresh, unconnected
  // workspace with no data yet — a demo/seeded workspace (or one that has
  // since disconnected but still has historical risk data) goes straight
  // to the real dashboard instead.
  const hasAnyData = Boolean(data && (data.totalOpenRisks > 0 || data.recentInsights.length > 0));
  if (!workspace.slackConnected && !loading && !hasAnyData) {
    return (
      <>
        <Topbar title="Overview" />
        <div className="p-6">
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="Connect Slack to start detecting risks"
            description="Risk Radar analyzes your team's Slack conversations to surface blockers, ghost work, and deadline risk automatically."
            action={
              <Link href="/dashboard/onboarding">
                <Button>Connect Slack</Button>
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Overview" />
      <div className="flex flex-col gap-6 p-6">
        {loading && <LoadingState label="Loading project health…" />}
        {error && <ErrorState description={error} action={<Button onClick={refetch}>Retry</Button>} />}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Health score" value={`${data.healthScore}`} icon={<Sparkles className="h-4 w-4" />} accent="primary" />
              <StatCard label="Critical" value={data.critical} icon={<AlertOctagon className="h-4 w-4" />} accent="critical" />
              <StatCard label="High" value={data.high} icon={<AlertTriangle className="h-4 w-4" />} accent="high" />
              <StatCard label="Open blockers" value={data.blockers} icon={<Ban className="h-4 w-4" />} accent="muted" />
              <StatCard label="Ghost work" value={data.ghostWork} icon={<Ghost className="h-4 w-4" />} accent="muted" />
              <StatCard label="Decision drift" value={data.decisionDrift} icon={<GitBranch className="h-4 w-4" />} accent="muted" />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Recent AI insights</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.recentInsights.length === 0 ? (
                    <EmptyState
                      title="No risks detected yet"
                      description="Run an analysis from the Risks page to generate your first insights."
                    />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.recentInsights.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{r.title}</p>
                            {r.project && <p className="text-xs text-muted-foreground">{r.project}</p>}
                          </div>
                          <SeverityBadge severity={r.severity as any} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Project trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No projects identified yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {data.projects.map((p) => (
                        <li key={p.id} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{p.name}</span>
                          <TrendBadge trend={p.trend} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: 'primary' | 'critical' | 'high' | 'muted';
}) {
  const accentClass = {
    primary: 'text-primary bg-primary/10',
    critical: 'text-critical bg-critical/10',
    high: 'text-high bg-high/10',
    muted: 'text-muted-foreground bg-muted',
  }[accent];

  return (
    <Card>
      <CardContent className="p-4">
        <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg', accentClass)}>{icon}</div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function TrendBadge({ trend }: { trend: 'IMPROVING' | 'STABLE' | 'INCREASING' }) {
  if (trend === 'IMPROVING')
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-low">
        <TrendingDown className="h-3.5 w-3.5" /> Improving
      </span>
    );
  if (trend === 'INCREASING')
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-critical">
        <TrendingUp className="h-3.5 w-3.5" /> Increasing
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Minus className="h-3.5 w-3.5" /> Stable
    </span>
  );
}
