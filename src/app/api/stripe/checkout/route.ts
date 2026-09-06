import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceAdmin, requireSession } from '@/lib/auth/workspace';
import { createCheckoutSession } from '@/lib/billing/stripe';
import { getStripePriceId } from '@/lib/billing/plans';
import { toApiErrorResponse } from '@/lib/utils/apiError';

const checkoutSchema = z.object({
  workspaceId: z.string(),
  plan: z.enum(['PRO', 'BUSINESS']),
});

export async function POST(req: NextRequest) {
  try {
    const body = checkoutSchema.parse(await req.json());
    await requireWorkspaceAdmin(body.workspaceId);
    const { email } = await requireSession();

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: body.workspaceId },
      include: { subscription: true },
    });

    const session = await createCheckoutSession({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      customerEmail: email,
      priceId: getStripePriceId(body.plan),
      successUrl: `${process.env.APP_URL}/dashboard/settings/billing?checkout=success`,
      cancelUrl: `${process.env.APP_URL}/dashboard/settings/billing?checkout=cancelled`,
      existingStripeCustomerId: workspace.subscription?.stripeCustomerId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
