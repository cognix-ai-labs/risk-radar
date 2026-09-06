import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/slack/signature';
import { resolveWorkspaceIdFromSlackTeam } from '@/lib/slack/ingest';
import { createTaskFromRisk } from '@/lib/risk-engine/tasks';
import { postMessage } from '@/lib/slack/client';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const valid = verifySlackSignature({
    signingSecret,
    timestamp: req.headers.get('x-slack-request-timestamp'),
    signature: req.headers.get('x-slack-signature'),
    rawBody,
  });
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get('payload') ?? '{}');

  const teamId = payload.team?.id;
  const workspaceId = teamId ? await resolveWorkspaceIdFromSlackTeam(teamId) : null;
  if (!workspaceId) return NextResponse.json({ ok: true });

  const action = payload.actions?.[0];
  if (action?.action_id === 'create_task_from_recommendation') {
    const riskId = action.value as string;
    handleCreateTask(workspaceId, riskId, payload.channel?.id).catch((err) =>
      console.error('[slack-interactions] create task failed:', err)
    );
  }

  return NextResponse.json({ ok: true });
}

async function handleCreateTask(workspaceId: string, riskId: string, channelId?: string): Promise<void> {
  const result = await createTaskFromRisk({ workspaceId, riskId });
  if (channelId) {
    const text = result.externalUrl ? `Task created: ${result.externalUrl}` : 'Task created — view it in the dashboard.';
    await postMessage(workspaceId, channelId, text);
  }
}
