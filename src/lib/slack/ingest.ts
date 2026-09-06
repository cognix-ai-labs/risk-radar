import { prisma } from '@/lib/prisma';

/** Resolves an incoming Slack event's team id to our internal workspaceId.
 *  Every Slack-event handler must go through this — never trust a
 *  workspaceId if one happened to be embedded in the payload. */
export async function resolveWorkspaceIdFromSlackTeam(slackTeamId: string): Promise<string | null> {
  const installation = await prisma.slackInstallation.findUnique({ where: { slackTeamId } });
  return installation?.isActive ? installation.workspaceId : null;
}

/**
 * Stores one Slack message event, but only if it belongs to a channel the
 * workspace has explicitly selected for analysis (isSelected=true) — this
 * is the enforcement point for "only analyze channels the customer opted
 * into," not just a UI-level filter.
 */
export async function ingestSlackMessageEvent(params: {
  workspaceId: string;
  slackChannelId: string;
  slackMessageTs: string;
  slackUserId: string;
  userDisplayName?: string;
  text: string;
  postedAt: Date;
  permalink?: string;
}): Promise<void> {
  const channel = await prisma.channel.findUnique({
    where: { workspaceId_slackChannelId: { workspaceId: params.workspaceId, slackChannelId: params.slackChannelId } },
  });

  if (!channel || !channel.isSelected) return; // silently ignore unselected channels

  await prisma.slackMessage.upsert({
    where: { channelId_slackMessageTs: { channelId: channel.id, slackMessageTs: params.slackMessageTs } },
    create: {
      workspaceId: params.workspaceId,
      channelId: channel.id,
      slackMessageTs: params.slackMessageTs,
      slackUserId: params.slackUserId,
      userDisplayName: params.userDisplayName,
      text: params.text,
      postedAt: params.postedAt,
      permalink: params.permalink,
    },
    update: {}, // idempotent on retry/duplicate delivery
  });
}
