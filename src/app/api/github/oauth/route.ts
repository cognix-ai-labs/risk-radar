import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { requireWorkspaceAdmin } from '@/lib/auth/workspace';
import { requireFeature } from '@/lib/billing/entitlement';
import { buildGitHubInstallUrl } from '@/lib/integrations/github';

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    await requireWorkspaceAdmin(workspaceId);
    await requireFeature(workspaceId, 'githubIntegration');

    const state = Buffer.from(JSON.stringify({ workspaceId, nonce: nanoid(16) })).toString('base64url');
    const url = buildGitHubInstallUrl(state);

    const res = NextResponse.redirect(url);
    res.cookies.set('github_oauth_state', state, { httpOnly: true, secure: true, maxAge: 600, sameSite: 'lax' });
    return res;
  } catch (error) {
    console.error('[github-oauth] failed to start:', error);
    return NextResponse.json({ error: 'Failed to start GitHub connection' }, { status: 500 });
  }
}
