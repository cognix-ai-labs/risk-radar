import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth/workspace';
import { toApiErrorResponse } from '@/lib/utils/apiError';

export async function GET() {
  try {
    const { userId } = await requireSession();

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: { include: { slackInstallation: true, subscription: true } } },
    });

    return NextResponse.json({
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        slackConnected: Boolean(m.workspace.slackInstallation?.isActive),
        plan: m.workspace.subscription?.plan ?? 'TRIAL',
        subscriptionStatus: m.workspace.subscription?.status ?? 'TRIALING',
      })),
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
