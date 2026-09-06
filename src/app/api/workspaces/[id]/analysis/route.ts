import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess } from '@/lib/auth/workspace';
import { enqueueAnalysisRun } from '@/lib/jobs/queue';
import { toApiErrorResponse } from '@/lib/utils/apiError';
import { rateLimit } from '@/lib/utils/rateLimit';

/** Triggers a manual analysis run over the workspace's selected channels.
 *  Enqueues only — the actual AI call happens in the background worker. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireWorkspaceAccess(params.id);

    const { allowed } = rateLimit(`analysis-trigger:${params.id}`, 10, 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Too many analysis requests — slow down.' }, { status: 429 });

    const selectedChannels = await prisma.channel.findMany({
      where: { workspaceId: params.id, isSelected: true },
    });

    if (selectedChannels.length === 0) {
      return NextResponse.json({ error: 'No channels selected for analysis yet.' }, { status: 400 });
    }

    const run = await enqueueAnalysisRun({
      workspaceId: params.id,
      channelIds: selectedChannels.map((c) => c.id),
      trigger: 'MANUAL',
      requestedByUserId: ctx.userId,
    });

    return NextResponse.json({ analysisRunId: run.id }, { status: 202 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireWorkspaceAccess(params.id);
    const runs = await prisma.analysisRun.findMany({
      where: { workspaceId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return NextResponse.json({ runs });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
