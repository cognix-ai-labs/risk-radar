import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  slackInstallation: { findUnique: vi.fn() },
  channel: { findUnique: vi.fn() },
  slackMessage: { upsert: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

const { resolveWorkspaceIdFromSlackTeam, ingestSlackMessageEvent } = await import('@/lib/slack/ingest');

describe('resolveWorkspaceIdFromSlackTeam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for an unknown/uninstalled Slack team (never guesses)', async () => {
    mockPrisma.slackInstallation.findUnique.mockResolvedValue(null);
    expect(await resolveWorkspaceIdFromSlackTeam('T_UNKNOWN')).toBeNull();
  });

  it('returns null for a deactivated installation', async () => {
    mockPrisma.slackInstallation.findUnique.mockResolvedValue({ workspaceId: 'ws_1', isActive: false });
    expect(await resolveWorkspaceIdFromSlackTeam('T_1')).toBeNull();
  });

  it('resolves an active installation to its workspace id', async () => {
    mockPrisma.slackInstallation.findUnique.mockResolvedValue({ workspaceId: 'ws_1', isActive: true });
    expect(await resolveWorkspaceIdFromSlackTeam('T_1')).toBe('ws_1');
  });
});

describe('ingestSlackMessageEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  const baseEvent = {
    workspaceId: 'ws_1',
    slackChannelId: 'C_1',
    slackMessageTs: '123.456',
    slackUserId: 'U_1',
    text: 'hello',
    postedAt: new Date(),
  };

  it('silently ignores messages from a channel the workspace has not selected for analysis', async () => {
    mockPrisma.channel.findUnique.mockResolvedValue({ id: 'ch_1', isSelected: false });
    await ingestSlackMessageEvent(baseEvent);
    expect(mockPrisma.slackMessage.upsert).not.toHaveBeenCalled();
  });

  it('ignores messages from channels the workspace does not even have a Channel row for', async () => {
    mockPrisma.channel.findUnique.mockResolvedValue(null);
    await ingestSlackMessageEvent(baseEvent);
    expect(mockPrisma.slackMessage.upsert).not.toHaveBeenCalled();
  });

  it('stores the message when the channel is selected', async () => {
    mockPrisma.channel.findUnique.mockResolvedValue({ id: 'ch_1', isSelected: true });
    await ingestSlackMessageEvent(baseEvent);
    expect(mockPrisma.slackMessage.upsert).toHaveBeenCalledOnce();
  });
});
