import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess, requireWorkspaceAdmin } from '@/lib/auth/workspace';
import { listSelectableChannels } from '@/lib/slack/client';
import { assertWithinChannelLimit } from '@/lib/billing/entitlement';
import { toApiErrorResponse } from '@/lib/utils/apiError';
import { writeAuditLog } from '@/lib/utils/audit';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireWorkspaceAccess(params.id);

    const [slackChannels, selected] = await Promise.all([
      listSelectableChannels(params.id),
      prisma.channel.findMany({ where: { workspaceId: params.id } }),
    ]);

    const selectedIds = new Set(selected.filter((c) => c.isSelected).map((c) => c.slackChannelId));

    return NextResponse.json({
      channels: slackChannels.map((c) => ({ ...c, isSelected: selectedIds.has(c.slackChannelId) })),
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

const selectChannelsSchema = z.object({
  channelIds: z.array(z.string()).max(50),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireWorkspaceAdmin(params.id);
    const body = selectChannelsSchema.parse(await req.json());

    await assertWithinChannelLimit(params.id, body.channelIds.length);

    const slackChannels = await listSelectableChannels(params.id);
    const byId = new Map(slackChannels.map((c) => [c.slackChannelId, c]));

    await prisma.$transaction(async (tx) => {
      await tx.channel.updateMany({ where: { workspaceId: params.id }, data: { isSelected: false } });

      for (const slackChannelId of body.channelIds) {
        const info = byId.get(slackChannelId);
        if (!info) continue; // ignore ids that don't actually exist in this workspace's Slack

        await tx.channel.upsert({
          where: { workspaceId_slackChannelId: { workspaceId: params.id, slackChannelId } },
          create: { workspaceId: params.id, slackChannelId, name: info.name, isPrivate: info.isPrivate, isSelected: true },
          update: { isSelected: true, name: info.name },
        });
      }
    });

    await writeAuditLog({
      workspaceId: params.id,
      userId: ctx.userId,
      action: 'channels.selected',
      metadata: { count: body.channelIds.length },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
