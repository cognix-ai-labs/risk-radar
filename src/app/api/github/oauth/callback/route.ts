import { NextRequest, NextResponse } from 'next/server';
import { exchangeGitHubOAuthCode, saveGitHubIntegration } from '@/lib/integrations/github';
import { requireWorkspaceAdmin } from '@/lib/auth/workspace';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookieState = req.cookies.get('github_oauth_state')?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/settings/integrations?error=invalid_state`);
  }

  try {
    const { workspaceId } = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    await requireWorkspaceAdmin(workspaceId);

    const { accessToken } = await exchangeGitHubOAuthCode(code);
    await saveGitHubIntegration({ workspaceId, accessToken });

    const res = NextResponse.redirect(`${process.env.APP_URL}/dashboard/settings/integrations?connected=github`);
    res.cookies.delete('github_oauth_state');
    return res;
  } catch (error) {
    console.error('[github-oauth-callback] failed:', error instanceof Error ? error.message : error);
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/settings/integrations?error=connect_failed`);
  }
}
