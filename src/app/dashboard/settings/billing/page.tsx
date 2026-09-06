'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Topbar } from '@/components/dashboard/topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/states';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { cn } from '@/lib/utils/cn';

const PLANS = [
  {
    tier: 'TRIAL' as const,
    name: 'Free Trial',
    price: '$0',
    features: ['14-day trial', '1 Slack workspace', '3 channels', 'Limited AI analyses'],
  },
  {
    tier: 'PRO' as const,
    name: 'Pro',
    price: '$29',
    features: ['More channels', 'Unlimited analysis (fair use)', 'Ghost Work detection', 'Decision Drift', 'GitHub integration'],
    highlight: true,
  },
  {
    tier: 'BUSINESS' as const,
    name: 'Business',
    price: '$99',
    features: ['Multiple teams/projects', 'Advanced analytics', 'Higher limits', 'Priority support', 'Admin controls'],
  },
];

export default function BillingPage() {
  const { workspace, loading } = useCurrentWorkspace();
  const [busy, setBusy] = useState<string | null>(null);

  async function upgrade(plan: 'PRO' | 'BUSINESS') {
    if (!workspace) return;
    setBusy(plan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id, plan }),
      });
      const body = await res.json();
      if (body.url) window.location.href = body.url;
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    if (!workspace) return;
    setBusy('portal');
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id }),
      });
      const body = await res.json();
      if (body.url) window.location.href = body.url;
    } finally {
      setBusy(null);
    }
  }

  if (loading || !workspace) return <LoadingState />;

  return (
    <>
      <Topbar title="Billing & plan" />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-lg font-semibold">{workspace.plan} · {workspace.subscriptionStatus}</p>
          </div>
          <Button variant="outline" onClick={openPortal} disabled={busy === 'portal'}>
            Manage billing
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <Card key={plan.tier} className={cn(plan.highlight && 'border-primary ring-1 ring-primary')}>
              <CardContent className="flex flex-col gap-4 p-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                  <p className="text-3xl font-semibold">
                    {plan.price}
                    {plan.tier !== 'TRIAL' && <span className="text-base font-normal text-muted-foreground">/mo</span>}
                  </p>
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-low" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.tier !== 'TRIAL' && (
                  <Button
                    className="mt-auto"
                    variant={plan.highlight ? 'primary' : 'outline'}
                    disabled={busy === plan.tier || workspace.plan === plan.tier}
                    onClick={() => upgrade(plan.tier)}
                  >
                    {workspace.plan === plan.tier ? 'Current plan' : busy === plan.tier ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
