import type { Risk, RiskEvidence, Recommendation } from '@prisma/client';

const SEVERITY_EMOJI: Record<string, string> = {
  Critical: '🚨',
  High: '🟠',
  Medium: '🟡',
  Low: '🟢',
};

type RiskWithRelations = Risk & { evidence: RiskEvidence[]; recommendations: Recommendation[]; projectName?: string | null };

/** Formats a single finding the way the product spec's example output
 *  looks: severity banner, reason, signals (evidence), recommended actions. */
export function formatRiskAsSlackBlocks(risk: RiskWithRelations): unknown[] {
  const emoji = SEVERITY_EMOJI[risk.severity] ?? '⚪';

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${risk.severity} Risk Detected`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Project:*\n${risk.projectName ?? 'Unassigned'}` },
        { type: 'mrkdwn', text: `*Confidence:*\n${Math.round(risk.confidence * 100)}%` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Reason:*\n${risk.description}` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Signals*\n${risk.evidence.map((e) => `• ${e.quote}`).join('\n')}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Recommended actions*\n${risk.recommendations.map((r) => `• ${r.text}`).join('\n')}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Create task', emoji: true },
          action_id: 'create_task_from_recommendation',
          value: risk.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in dashboard', emoji: true },
          url: `${process.env.APP_URL}/dashboard/risks/${risk.id}`,
          action_id: 'view_in_dashboard',
        },
      ],
    },
    { type: 'divider' },
  ];
}

export function formatRiskReportText(counts: { critical: number; high: number; medium: number; low: number }, topConcern?: string): string {
  const lines = [
    "*Today's Risk Report*",
    `🔴 ${counts.critical} Critical`,
    `🟠 ${counts.high} High`,
    `🟡 ${counts.medium} Medium`,
  ];
  if (topConcern) {
    lines.push('', '*Top concern*', topConcern);
  }
  return lines.join('\n');
}
