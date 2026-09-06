import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { toApiErrorResponse } from '@/lib/utils/apiError';
import { rateLimit } from '@/lib/utils/rateLimit';
import { PLAN_DEFINITIONS } from '@/lib/billing/plans';

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  workspaceName: z.string().min(1).max(100),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'workspace'
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const { allowed } = rateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many signup attempts. Try again later.' }, { status: 429 });
    }

    const body = registerSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.password);
    const trialDays = PLAN_DEFINITIONS.TRIAL.trialDays ?? 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    const baseSlug = slugify(body.workspaceName);
    const slug = `${baseSlug}-${nanoid(6)}`;

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { email, name: body.name, passwordHash },
      });

      const workspace = await tx.workspace.create({
        data: { name: body.workspaceName, slug, ownerId: createdUser.id },
      });

      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: createdUser.id, role: 'OWNER' },
      });

      await tx.subscription.create({
        data: { workspaceId: workspace.id, plan: 'TRIAL', status: 'TRIALING', trialEndsAt },
      });

      return { userId: createdUser.id, workspaceId: workspace.id };
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
