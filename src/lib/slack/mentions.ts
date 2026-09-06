import { prisma } from '@/lib/prisma';
import { getAIProvider } from '@/lib/ai/provider';
import { createTaskFromRisk } from '@/lib/risk-engine/tasks';
import type { RiskContextForQA } from '@/lib/ai/types';

type MentionIntent = 'what_to_worry_about' | 'explain_risk' | 'create_task' | 'unknown';

export function classifyMentionIntent(text: string): MentionIntent {
  const lower = text.toLowerCase();
  if (/(create|make|open)\s+(a\s+)?task/.test(lower)) return 'create_task';
  if (/explain/.test(lower)) return 'explain_risk';
  if (/worry|concern|watch out|today/.test(lower)) return 'what_to_worry_about';
  return 'unknown';
}

async function loadRiskContext(workspaceId: string): Promise<RiskContextForQA> {
  const [workspace, risks] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    prisma.risk.findMany({
      where: { workspaceId, status: { in: ['NEW', 'INVESTIGATING'] } },
      include: { evidence: true, recommendations: true, project: true },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    }),
  ]);

  return {
    workspaceName: workspace.name,
    risks: risks.map((r) => ({
      id: r.id,
      type: r.type,
      severity: r.severity,
      confidence: r.confidence,
      title: r.title,
      description: r.description,
      project: r.project?.name ?? null,
      evidence: r.evidence.map((e) => e.quote),
      recommendedActions: r.recommendations.map((rec) => rec.text),
    })),
  };
}

/** Handles an @RiskRadar mention and returns the text to post back. Runs
 *  fully server-side; the Slack event handler just calls this and posts
 *  the result — no business logic lives in the route handler. */
export async function handleMention(params: { workspaceId: string; text: string; slackUserId: string }): Promise<string> {
  const intent = classifyMentionIntent(params.text);
  const provider = getAIProvider();

  if (intent === 'create_task') {
    const topRisk = await prisma.risk.findFirst({
      where: { workspaceId: params.workspaceId, status: { in: ['NEW', 'INVESTIGATING'] } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
    if (!topRisk) return "There's nothing open to create a task from right now — run `/risk` after your next analysis.";

    const result = await createTaskFromRisk({ workspaceId: params.workspaceId, riskId: topRisk.id });
    return result.externalUrl
      ? `Created a task: ${result.externalUrl}`
      : `Created a task: *${topRisk.title}*. View it in the dashboard for details.`;
  }

  const context = await loadRiskContext(params.workspaceId);

  if (intent === 'explain_risk') {
    if (context.risks.length === 0) return "There's nothing to explain — no active risks right now.";
    return provider.answerAboutRisks('Explain the most important current risk in detail, including evidence and reasoning.', context);
  }

  // Default to "what should I worry about today" for both the explicit
  // intent and anything unrecognized — a safe, useful fallback rather than
  // a generic "I don't understand" chatbot reply.
  return provider.answerAboutRisks('What are the 3 to 5 most important things to worry about today?', context);
}
