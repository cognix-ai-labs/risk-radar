import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAccess } from '@/lib/auth/workspace';
import { toApiErrorResponse } from '@/lib/utils/apiError';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireWorkspaceAccess(params.id);

    const status = req.nextUrl.searchParams.get('status');
    const type = req.nextUrl.searchParams.get('type');
    const severity = req.nextUrl.searchParams.get('severity');

    const risks = await prisma.risk.findMany({
      where: {
        workspaceId: params.id, // tenant isolation — always scoped to the authorized workspace
        status: status ? (status as any) : undefined,
        type: type ? (type as any) : undefined,
        severity: severity ? (severity as any) : undefined,
      },
      include: { evidence: true, recommendations: true, project: true, tasks: true },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ risks });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
