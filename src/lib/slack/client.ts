import { WebClient } from '@slack/web-api';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/encryption';

/** Builds a per-workspace Slack client from the stored (encrypted) bot
 *  token. Never cache the decrypted token beyond this call's scope, and
 *  never log `client` or the token. */
export async function getSlackClientForWorkspace(workspaceId: string): Promise<WebClient> {
  const installation = await prisma.slackInstallation.findUnique({ where: { workspaceId } });
  if (!installation || !installation.isActive) {
    throw new Error('No active Slack installation for this workspace');
  }
  const token = decryptSecret(installation.botAccessToken);
  return new WebClient(token);
}

export async function listSelectableChannels(workspaceId: string) {
  const client = await getSlackClientForWorkspace(workspaceId);
  const result = await client.conversations.list({
    types: 'public_channel,private_channel',
    exclude_archived: true,
    limit: 200,
  });
  return (result.channels ?? []).map((c) => ({
    slackChannelId: c.id!,
    name: c.name ?? 'unknown',
    isPrivate: Boolean(c.is_private),
  }));
}

export async function fetchRecentMessages(workspaceId: string, slackChannelId: string, limit = 100) {
  const client = await getSlackClientForWorkspace(workspaceId);
  const result = await client.conversations.history({ channel: slackChannelId, limit });
  return result.messages ?? [];
}

export async function postMessage(workspaceId: string, channelId: string, text: string, blocks?: unknown[]) {
  const client = await getSlackClientForWorkspace(workspaceId);
  return client.chat.postMessage({ channel: channelId, text, blocks: blocks as any });
}

export async function resolveUserDisplayName(workspaceId: string, slackUserId: string): Promise<string> {
  try {
    const client = await getSlackClientForWorkspace(workspaceId);
    const result = await client.users.info({ user: slackUserId });
    return result.user?.profile?.display_name || result.user?.real_name || slackUserId;
  } catch {
    return slackUserId;
  }
}
