'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Slack, Check, ArrowRight, Hash, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { useFetch } from '@/lib/hooks/useFetch';
import { cn } from '@/lib/utils/cn';

type Step = 'connect' | 'channels' | 'analyze';

interface SlackChannel {
  slackChannelId: string;
  name: string;
  isPrivate: boolean;
  isSelected: boolean;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingState label="Setting things up…" />}>
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const { workspace, loading: wsLoading, refetch: refetchWorkspace } = useCurrentWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();
  const oauthError = searchParams.get('error');

  const [step, setStep] = useState<Step>('connect');

  useEffect(() => {
    if (workspace?.slackConnected && step === 'connect') setStep('channels');
  }, [workspace?.slackConnected, step]);

  if (wsLoading) return <LoadingState label="Setting things up…" />;
  if (!workspace) return <ErrorState description="Couldn't load your workspace." />;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <Stepper step={step} />

      {oauthError && (
        <div className="mb-6">
          <ErrorState description="Something went wrong connecting Slack. Please try again." />
        </div>
      )}

      {step === 'connect' && <ConnectStep workspaceId={workspace.id} />}
      {step === 'channels' && (
        <ChannelsStep
          workspaceId={workspace.id}
          onDone={() => setStep('analyze')}
        />
      )}
      {step === 'analyze' && (
        <AnalyzeStep
          workspaceId={workspace.id}
          onDone={() => router.push('/dashboard')}
        />
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'connect', label: 'Connect Slack' },
    { key: 'channels', label: 'Select channels' },
    { key: 'analyze', label: 'Analyze' },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="mb-10 flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
              i < activeIndex ? 'bg-primary text-primary-foreground' : i === activeIndex ? 'bg-primary/15 text-primary ring-2 ring-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            {i < activeIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={cn('text-sm', i === activeIndex ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s.label}</span>
          {i < steps.length - 1 && <div className="h-px w-8 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function ConnectStep({ workspaceId }: { workspaceId: string }) {
  return (
    <Card className="text-center">
      <CardContent className="flex flex-col items-center gap-4 p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Slack className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Connect your Slack workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Risk Radar requests read access only to channels you choose in the next step, plus permission to post
            findings back and respond to <code className="rounded bg-muted px-1">/risk</code> and{' '}
            <code className="rounded bg-muted px-1">@RiskRadar</code>.
          </p>
        </div>
        <a href={`/api/slack/oauth?workspaceId=${workspaceId}`}>
          <Button size="lg">
            <Slack className="h-4 w-4" />
            Add to Slack
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

function ChannelsStep({ workspaceId, onDone }: { workspaceId: string; onDone: () => void }) {
  const { data, error, loading } = useFetch<{ channels: SlackChannel[] }>(`/api/workspaces/${workspaceId}/channels`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setSelected(new Set(data.channels.filter((c) => c.isSelected).map((c) => c.slackChannelId)));
  }, [data]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/channels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds: Array.from(selected) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to save channel selection');
      onDone();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save channel selection');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading your channels…" />;
  if (error) return <ErrorState description={error} />;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Select channels to analyze</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Only messages in selected channels are read and stored. You can change this anytime.
        </p>

        <div className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
          {data?.channels.map((c) => (
            <label
              key={c.slackChannelId}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={selected.has(c.slackChannelId)}
                onChange={() => toggle(c.slackChannelId)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
              />
              {c.isPrivate ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Hash className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-sm">{c.name}</span>
            </label>
          ))}
        </div>

        {saveError && <p className="mt-3 text-sm text-critical">{saveError}</p>}

        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={saving || selected.size === 0}>
            {saving ? 'Saving…' : `Continue with ${selected.size} channel${selected.size === 1 ? '' : 's'}`}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyzeStep({ workspaceId, onDone }: { workspaceId: string; onDone: () => void }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function start() {
    setStatus('running');
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/analysis`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to start analysis');
      setTimeout(onDone, 3000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start analysis');
    }
  }

  return (
    <Card className="text-center">
      <CardContent className="flex flex-col items-center gap-4 p-10">
        <h2 className="text-lg font-semibold">Ready to analyze</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          We&rsquo;ll scan your selected channels for blockers, dependencies, deadline risk, and untracked work —
          this usually takes under a minute.
        </p>
        {status === 'error' && <p className="text-sm text-critical">{errorMsg}</p>}
        <Button size="lg" onClick={start} disabled={status === 'running'}>
          {status === 'running' ? 'Analyzing…' : 'Start first analysis'}
        </Button>
      </CardContent>
    </Card>
  );
}
