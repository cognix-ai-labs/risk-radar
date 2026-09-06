import { prisma } from '@/lib/prisma';
import { getAIProvider, enforceEvidenceGrounding } from '@/lib/ai/provider';
import type { AnalyzableMessage } from '@/lib/ai/types';
import { recordAnalysisUsage } from '@/lib/billing/entitlement';
import { writeAuditLog } from '@/lib/utils/audit';

/**
 * Runs the full risk-analysis pipeline for one AnalysisRun row:
 *   load messages -> AI provider -> evidence enforcement -> persist Risk +
 *   RiskEvidence + Recommendation -> update run status/usage.
 *
 * Called by the background worker (scripts/worker.ts), never inline in an
 * HTTP request handler — analysis can take several seconds per batch.
 */
export async function processAnalysisRun(runId: string): Promise<void> {
  const run = await prisma.analysisRun.update({
    where: { id: runId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  try {
    const messages = await prisma.slackMessage.findMany({
      where: {
        workspaceId: run.workspaceId,
        channelId: run.channelIds.length > 0 ? { in: run.channelIds } : undefined,
      },
      include: { channel: true },
      orderBy: { postedAt: 'asc' },
      take: 500,
    });

    const analyzable: AnalyzableMessage[] = messages.map((m) => ({
      messageId: m.id,
      channelName: m.channel.name,
      userDisplayName: m.userDisplayName ?? m.slackUserId,
      text: m.text,
      postedAt: m.postedAt.toISOString(),
      permalink: m.permalink ?? undefined,
    }));

    const provider = getAIProvider();
    const rawResult = await provider.analyzeMessages(analyzable);
    const result = enforceEvidenceGrounding(rawResult, analyzable);

    let risksCreated = 0;

    await prisma.$transaction(async (tx) => {
      for (const finding of result.findings) {
        let project = finding.project
          ? await tx.project.findFirst({ where: { workspaceId: run.workspaceId, name: finding.project } })
          : null;

        if (!project && finding.project) {
          project = await tx.project.create({
            data: { workspaceId: run.workspaceId, name: finding.project },
          });
        }

        const risk = await tx.risk.create({
          data: {
            workspaceId: run.workspaceId,
            projectId: project?.id,
            analysisRunId: run.id,
            type: finding.type,
            severity: finding.severity,
            confidence: finding.confidence,
            title: finding.title,
            description: finding.description,
            affectedPeople: finding.affectedPeople,
            affectedDeadline: finding.affectedDeadline,
          },
        });

        await tx.riskEvidence.createMany({
          data: finding.evidence.map((e) => ({
            riskId: risk.id,
            slackMessageId: e.messageId,
            quote: e.quote,
          })),
        });

        await tx.recommendation.createMany({
          data: finding.recommendedActions.map((text) => ({ riskId: risk.id, text })),
        });

        risksCreated += 1;
      }

      await tx.analysisRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          messagesAnalyzed: analyzable.length,
          risksFound: risksCreated,
        },
      });
    });

    await updateProjectTrends(run.workspaceId);
    await recordAnalysisUsage(run.workspaceId, analyzable.length);
    await writeAuditLog({
      workspaceId: run.workspaceId,
      action: 'analysis.completed',
      metadata: { runId: run.id, messagesAnalyzed: analyzable.length, risksFound: risksCreated },
    });
  } catch (error) {
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error during analysis',
      },
    });
    throw error;
  }
}

/** Simple trend heuristic: compares open High/Critical risk counts created
 *  in the last 7 days vs the 7 days before that. Good enough for an MVP
 *  "Improving / Stable / Increasing" signal without a full time-series store. */
async function updateProjectTrends(workspaceId: string): Promise<void> {
  const projects = await prisma.project.findMany({ where: { workspaceId } });
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  for (const project of projects) {
    const [recent, prior] = await Promise.all([
      prisma.risk.count({
        where: {
          projectId: project.id,
          severity: { in: ['High', 'Critical'] },
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.risk.count({
        where: {
          projectId: project.id,
          severity: { in: ['High', 'Critical'] },
          createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo },
        },
      }),
    ]);

    const trend = recent > prior ? 'INCREASING' : recent < prior ? 'IMPROVING' : 'STABLE';
    await prisma.project.update({ where: { id: project.id }, data: { trend } });
  }
}
