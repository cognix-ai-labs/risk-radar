import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess } from '@/lib/auth/workspace';
import { toApiErrorResponse } from '@/lib/utils/apiError';
import { writeAuditLog } from '@/lib/utils/audit';

export async function GET(_req: NextRequest, { params }: { params: { id: string; riskId: string } }) {
  try {
    await requireWorkspaceAccess(params.id);

    const risk = await prisma.risk.findFirst({
      where: { id: params.riskId, workspaceId: params.id }, // scoped lookup — a risk id from another workspace 404s, not leaks
      include: { evidence: { include: { slackMessage: true } }, recommendations: true, project: true, tasks: true },
    });

    if (!risk) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ risk });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

const updateStatusSchema = z.object({
  status: z.enum(['NEW', 'INVESTIGATING', 'RESOLVED', 'IGNORED']),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; riskId: string } }) {
  try {
    const ctx = await requireWorkspaceAccess(params.id);
    const body = updateStatusSchema.parse(await req.json());

    const existing = await prisma.risk.findFirst({ where: { id: params.riskId, workspaceId: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const risk = await prisma.risk.update({ where: { id: params.riskId }, data: { status: body.status } });

    await writeAuditLog({
      workspaceId: params.id,
      userId: ctx.userId,
      action: 'risk.status_changed',
      metadata: { riskId: risk.id, from: existing.status, to: body.status },
    });

    return NextResponse.json({ risk });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
