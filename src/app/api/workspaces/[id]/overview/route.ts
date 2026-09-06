import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess } from '@/lib/auth/workspace';
import { toApiErrorResponse } from '@/lib/utils/apiError';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireWorkspaceAccess(params.id);

    const openRisks = await prisma.risk.findMany({
      where: { workspaceId: params.id, status: { in: ['NEW', 'INVESTIGATING'] } },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });

    const critical = openRisks.filter((r) => r.severity === 'Critical').length;
    const high = openRisks.filter((r) => r.severity === 'High').length;
    const blockers = openRisks.filter((r) => r.type === 'blocker').length;
    const ghostWork = openRisks.filter((r) => r.type === 'ghost_work').length;
    const decisionDrift = openRisks.filter((r) => r.type === 'decision_drift').length;

    // Simple 0-100 health score: starts at 100, docked per open risk by severity.
    const healthScore = Math.max(
      0,
      100 -
        openRisks.reduce((total, r) => {
          const weight = { Critical: 20, High: 10, Medium: 4, Low: 1 }[r.severity] ?? 0;
          return total + weight;
        }, 0)
    );

    const projects = await prisma.project.findMany({ where: { workspaceId: params.id } });

    const recentInsights = openRisks.slice(0, 8).map((r) => ({
      id: r.id,
      type: r.type,
      severity: r.severity,
      title: r.title,
      project: r.project?.name ?? null,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({
      healthScore,
      critical,
      high,
      blockers,
      ghostWork,
      decisionDrift,
      totalOpenRisks: openRisks.length,
      projects: projects.map((p) => ({ id: p.id, name: p.name, trend: p.trend })),
      recentInsights,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
