import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/slack/signature';
import { resolveWorkspaceIdFromSlackTeam, ingestSlackMessageEvent } from '@/lib/slack/ingest';
import { handleMention } from '@/lib/slack/mentions';
import { postMessage } from '@/lib/slack/client';
import { rateLimit } from '@/lib/utils/rateLimit';

/** Slack requires this endpoint to respond within 3 seconds. Mention
 *  handling calls the AI provider, so we ack immediately and process async
 *  — Slack will not retry once it has a 200, and posting the reply as a
 *  follow-up chat.postMessage call is the documented pattern for this. */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    console.error('[slack-events] SLACK_SIGNING_SECRET is not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const valid = verifySlackSignature({
    signingSecret,
    timestamp: req.headers.get('x-slack-request-timestamp'),
    signature: req.headers.get('x-slack-signature'),
    rawBody,
  });
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== 'event_callback') {
    return NextResponse.json({ ok: true });
  }

  const slackTeamId = payload.team_id as string;
  const { allowed } = rateLimit(`slack-events:${slackTeamId}`, 60, 60 * 1000);
  if (!allowed) return NextResponse.json({ ok: true }); // drop silently, still ack

  const workspaceId = await resolveWorkspaceIdFromSlackTeam(slackTeamId);
  if (!workspaceId) return NextResponse.json({ ok: true }); // uninstalled/unknown team

  const event = payload.event;

  // Fire-and-forget: Slack needs the HTTP response fast, so event handling
  // continues after we return. Errors are logged, never surfaced to Slack
  // (which would trigger unnecessary retries).
  handleSlackEvent(workspaceId, event).catch((err) => console.error('[slack-events] handler error:', err));

  return NextResponse.json({ ok: true });
}

async function handleSlackEvent(workspaceId: string, event: any): Promise<void> {
  if (!event) return;

  if (event.type === 'app_mention') {
    const cleanedText = String(event.text ?? '').replace(/<@[^>]+>/g, '').trim();
    const reply = await handleMention({ workspaceId, text: cleanedText, slackUserId: event.user });
    await postMessage(workspaceId, event.channel, reply);
    return;
  }

  if (event.type === 'message' && !event.subtype && event.channel_type !== 'im') {
    await ingestSlackMessageEvent({
      workspaceId,
      slackChannelId: event.channel,
      slackMessageTs: event.ts,
      slackUserId: event.user,
      text: event.text ?? '',
      postedAt: new Date(Number(event.ts) * 1000),
    });
  }
}
