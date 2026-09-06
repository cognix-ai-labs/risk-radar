import { prisma } from '@/lib/prisma';
import type { AnalysisTrigger } from '@prisma/client';
import { assertWithinAnalysisLimit } from '@/lib/billing/entitlement';

/**
 * Enqueues an analysis job. This is intentionally just an AnalysisRun row
 * with status=PENDING — the worker (scripts/worker.ts) polls for these.
 * HTTP handlers call this and return immediately; they must never call
 * processAnalysisRun() directly, which can take several seconds.
 */
export async function enqueueAnalysisRun(params: {
  workspaceId: string;
  channelIds: string[];
  trigger: AnalysisTrigger;
  requestedByUserId?: string;
}): Promise<{ id: string }> {
  await assertWithinAnalysisLimit(params.workspaceId);

  const run = await prisma.analysisRun.create({
    data: {
      workspaceId: params.workspaceId,
      channelIds: params.channelIds,
      trigger: params.trigger,
      requestedByUserId: params.requestedByUserId,
      status: 'PENDING',
    },
  });

  return { id: run.id };
}
