import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/slack/signature';
import { resolveWorkspaceIdFromSlackTeam } from '@/lib/slack/ingest';
import { buildTodaysRiskReport } from '@/lib/slack/riskReport';
import { rateLimit } from '@/lib/utils/rateLimit';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const valid = verifySlackSignature({
    signingSecret,
    timestamp: req.headers.get('x-slack-request-timestamp'),
    signature: req.headers.get('x-slack-signature'),
    rawBody,
  });
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const params = new URLSearchParams(rawBody);
  const teamId = params.get('team_id') ?? '';
  const command = params.get('command');

  const { allowed } = rateLimit(`slack-command:${teamId}`, 20, 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ response_type: 'ephemeral', text: 'Too many requests — try again in a minute.' });
  }

  if (command !== '/risk') {
    return NextResponse.json({ response_type: 'ephemeral', text: 'Unknown command.' });
  }

  const workspaceId = await resolveWorkspaceIdFromSlackTeam(teamId);
  if (!workspaceId) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: "This Slack workspace isn't connected to Risk Radar yet.",
    });
  }

  const text = await buildTodaysRiskReport(workspaceId);
  return NextResponse.json({ response_type: 'in_channel', text });
}
