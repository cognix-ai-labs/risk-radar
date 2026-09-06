import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkspaceAccess } from '@/lib/auth/workspace';
import { createTaskFromRisk } from '@/lib/risk-engine/tasks';
import { requireFeature } from '@/lib/billing/entitlement';
import { toApiErrorResponse } from '@/lib/utils/apiError';

const createTaskSchema = z.object({
  recommendationId: z.string().optional(),
  integrationType: z.enum(['INTERNAL', 'GITHUB']).default('INTERNAL'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string; riskId: string } }) {
  try {
    const ctx = await requireWorkspaceAccess(params.id);
    const body = createTaskSchema.parse(await req.json().catch(() => ({})));

    if (body.integrationType === 'GITHUB') {
      await requireFeature(params.id, 'githubIntegration');
    }

    const task = await createTaskFromRisk({
      workspaceId: params.id,
      riskId: params.riskId,
      recommendationId: body.recommendationId,
      createdByUserId: ctx.userId,
      integrationType: body.integrationType,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
