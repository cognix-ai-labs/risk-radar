import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceAdmin } from '@/lib/auth/workspace';
import { disconnectSlack } from '@/lib/slack/oauth';
import { toApiErrorResponse } from '@/lib/utils/apiError';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireWorkspaceAdmin(params.id);
    await disconnectSlack(params.id, ctx.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
