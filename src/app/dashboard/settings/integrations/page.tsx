'use client';

import { useState } from 'react';
import { Github, Slack, AlertTriangle } from 'lucide-react';
import { Topbar } from '@/components/dashboard/topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/states';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';

export default function IntegrationsPage() {
  const { workspace, loading, refetch } = useCurrentWorkspace();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnectSlack() {
    if (!workspace) return;
    setDisconnecting(true);
    try {
      await fetch(`/api/workspaces/${workspace.id}/slack/disconnect`, { method: 'POST' });
      refetch();
    } finally {
      setDisconnecting(false);
      setConfirmingDisconnect(false);
    }
  }

  if (loading || !workspace) return <LoadingState />;

  return (
    <>
      <Topbar title="Integrations" />
      <div className="flex flex-col gap-4 p-6">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4A154B]/10 text-[#4A154B] dark:text-[#ecb8ee]">
                <Slack className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Slack</p>
                <p className="text-sm text-muted-foreground">
                  {workspace.slackConnected ? 'Connected — reading selected channels' : 'Not connected'}
                </p>
              </div>
            </div>

            {workspace.slackConnected &&
              (confirmingDisconnect ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Delete all stored messages & channels?</span>
                  <Button size="sm" variant="destructive" onClick={disconnectSlack} disabled={disconnecting}>
                    {disconnecting ? 'Disconnecting…' : 'Confirm'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmingDisconnect(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmingDisconnect(true)}>
                  Disconnect
                </Button>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">GitHub</p>
                <p className="text-sm text-muted-foreground">Create issues directly from a detected risk.</p>
              </div>
            </div>
            {workspace.plan === 'TRIAL' ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Requires Pro or Business
              </span>
            ) : (
              <a href={`/api/github/oauth?workspaceId=${workspace.id}`}>
                <Button size="sm" variant="outline">
                  Connect
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
