import { prisma } from '@/lib/prisma';
import { GitHubIntegration } from '@/lib/integrations/github';
import { writeAuditLog } from '@/lib/utils/audit';
import type { TaskIntegrationType } from '@prisma/client';

/**
 * Creates a Task from a Risk's recommendation. If `integrationType` is
 * GITHUB and the workspace has GitHub connected, also creates a real
 * GitHub issue and links it — otherwise falls back to an internal-only
 * task so the "Create task" action always succeeds even without an
 * integration configured.
 */
export async function createTaskFromRisk(params: {
  workspaceId: string;
  riskId: string;
  recommendationId?: string;
  createdByUserId?: string;
  integrationType?: TaskIntegrationType;
}): Promise<{ id: string; externalUrl: string | null }> {
  const risk = await prisma.risk.findFirstOrThrow({
    where: { id: params.riskId, workspaceId: params.workspaceId }, // workspaceId filter enforces tenant isolation
    include: { evidence: true, recommendations: true, project: true },
  });

  const recommendation = params.recommendationId
    ? risk.recommendations.find((r) => r.id === params.recommendationId)
    : risk.recommendations[0];

  const title = recommendation ? recommendation.text : risk.title;
  let externalUrl: string | null = null;
  let externalId: string | null = null;
  let integrationType: TaskIntegrationType = 'INTERNAL';

  if (params.integrationType === 'GITHUB') {
    try {
      const github = await GitHubIntegration.forWorkspace(params.workspaceId);
      const issue = await github.createIssue({
        title: `[Risk Radar] ${title}`,
        description: risk.description,
        evidence: risk.evidence.map((e) => e.quote),
        recommendedAction: title,
      });
      externalUrl = issue.externalUrl;
      externalId = issue.externalId;
      integrationType = 'GITHUB';
    } catch (error) {
      // Fall back to an internal task rather than failing the whole action
      // — the user still gets a task even if GitHub isn't reachable.
      console.error('[tasks] GitHub issue creation failed, falling back to internal task:', error);
    }
  }

  const task = await prisma.task.create({
    data: {
      workspaceId: params.workspaceId,
      riskId: risk.id,
      recommendationId: recommendation?.id,
      title,
      description: risk.description,
      integrationType,
      externalUrl,
      externalId,
      createdByUserId: params.createdByUserId,
    },
  });

  await writeAuditLog({
    workspaceId: params.workspaceId,
    userId: params.createdByUserId,
    action: 'task.created',
    metadata: { taskId: task.id, riskId: risk.id, integrationType },
  });

  return { id: task.id, externalUrl };
}
