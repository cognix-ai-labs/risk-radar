import { prisma } from '@/lib/prisma';
import { formatRiskReportText } from './blocks';

export async function buildTodaysRiskReport(workspaceId: string): Promise<string> {
  const openRisks = await prisma.risk.findMany({
    where: { workspaceId, status: { in: ['NEW', 'INVESTIGATING'] } },
    include: { project: true },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
  });

  const counts = {
    critical: openRisks.filter((r) => r.severity === 'Critical').length,
    high: openRisks.filter((r) => r.severity === 'High').length,
    medium: openRisks.filter((r) => r.severity === 'Medium').length,
    low: openRisks.filter((r) => r.severity === 'Low').length,
  };

  const top = openRisks[0];
  const topConcern = top
    ? `${top.project ? `${top.project.name} — ` : ''}${top.description}`
    : undefined;

  return formatRiskReportText(counts, topConcern);
}
