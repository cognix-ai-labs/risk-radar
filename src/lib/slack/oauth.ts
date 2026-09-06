import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/encryption';
import { writeAuditLog } from '@/lib/utils/audit';

/**
 * Least-privilege scope set — only what each documented feature actually
 * needs. Do not add a scope here "just in case"; a new capability should
 * come with a new scope added deliberately and reviewed.
 *
 *   channels:history / groups:history  -> read messages in selected public/private channels
 *   channels:read / groups:read        -> list channels for the onboarding picker
 *   chat:write                         -> post findings back into Slack
 *   commands                           -> /risk slash command
 *   app_mentions:read                  -> @RiskRadar mention interaction
 *   users:read                         -> resolve user IDs to display names for evidence/UI
 */
export const SLACK_BOT_SCOPES = [
  'channels:history',
  'channels:read',
  'groups:history',
  'groups:read',
  'chat:write',
  'commands',
  'app_mentions:read',
  'users:read',
].join(',');

export function buildSlackInstallUrl(state: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) throw new Error('SLACK_CLIENT_ID is not set');

  const redirectUri = `${process.env.APP_URL}/api/slack/oauth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SLACK_BOT_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  scope?: string;
  bot_user_id?: string;
  team?: { id: string; name: string };
}

/** Exchanges the OAuth `code` for a bot token. Never log the response body
 *  — it contains the access token in plaintext. */
export async function exchangeSlackOAuthCode(code: string): Promise<SlackOAuthResponse> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Slack OAuth env vars are not configured');

  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${process.env.APP_URL}/api/slack/oauth/callback`,
    }),
  });

  const data = (await res.json()) as SlackOAuthResponse;
  if (!data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${data.error ?? 'unknown error'}`);
  }
  return data;
}

export async function completeSlackInstallation(params: {
  workspaceId: string;
  installedByUserId: string;
  oauth: SlackOAuthResponse;
}): Promise<void> {
  const { workspaceId, installedByUserId, oauth } = params;
  if (!oauth.team || !oauth.access_token || !oauth.bot_user_id) {
    throw new Error('Incomplete Slack OAuth response');
  }

  await prisma.slackInstallation.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      slackTeamId: oauth.team.id,
      slackTeamName: oauth.team.name,
      botUserId: oauth.bot_user_id,
      botAccessToken: encryptSecret(oauth.access_token),
      scope: oauth.scope ?? '',
      installedByUserId,
      isActive: true,
    },
    update: {
      slackTeamId: oauth.team.id,
      slackTeamName: oauth.team.name,
      botUserId: oauth.bot_user_id,
      botAccessToken: encryptSecret(oauth.access_token),
      scope: oauth.scope ?? '',
      isActive: true,
    },
  });

  await writeAuditLog({
    workspaceId,
    userId: installedByUserId,
    action: 'slack.installed',
    metadata: { slackTeamId: oauth.team.id, slackTeamName: oauth.team.name },
  });
}

/** Disconnects Slack and deletes all stored workspace Slack data, per the
 *  "disconnect and delete" requirement. Channels/messages are removed;
 *  Risks derived from them are kept (they're the workspace's own
 *  intelligence output) unless the caller also requests a full purge. */
export async function disconnectSlack(workspaceId: string, requestedByUserId: string): Promise<void> {
  await prisma.$transaction([
    prisma.slackMessage.deleteMany({ where: { workspaceId } }),
    prisma.channel.deleteMany({ where: { workspaceId } }),
    prisma.slackInstallation.deleteMany({ where: { workspaceId } }),
  ]);

  await writeAuditLog({
    workspaceId,
    userId: requestedByUserId,
    action: 'slack.disconnected',
  });
}
