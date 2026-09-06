import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAdmin } from '@/lib/auth/workspace';
import { createBillingPortalSession } from '@/lib/billing/stripe';
import { toApiErrorResponse } from '@/lib/utils/apiError';

const portalSchema = z.object({ workspaceId: z.string() });

export async function POST(req: NextRequest) {
  try {
    const body = portalSchema.parse(await req.json());
    await requireWorkspaceAdmin(body.workspaceId);

    const subscription = await prisma.subscription.findUnique({ where: { workspaceId: body.workspaceId } });
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found for this workspace yet.' }, { status: 400 });
    }

    const session = await createBillingPortalSession({
      stripeCustomerId: subscription.stripeCustomerId,
      returnUrl: `${process.env.APP_URL}/dashboard/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
