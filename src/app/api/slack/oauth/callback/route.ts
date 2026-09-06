import { NextRequest, NextResponse } from 'next/server';
import { exchangeSlackOAuthCode, completeSlackInstallation } from '@/lib/slack/oauth';
import { requireWorkspaceAdmin } from '@/lib/auth/workspace';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookieState = req.cookies.get('slack_oauth_state')?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/onboarding?error=invalid_state`);
  }

  let decoded: { workspaceId: string; userId: string };
  try {
    decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/onboarding?error=invalid_state`);
  }

  try {
    // Confirms the session user is still an admin/owner of the workspace
    // the install was started for — the state cookie alone isn't trusted
    // as authorization.
    await requireWorkspaceAdmin(decoded.workspaceId);

    const oauth = await exchangeSlackOAuthCode(code);
    await completeSlackInstallation({ workspaceId: decoded.workspaceId, installedByUserId: decoded.userId, oauth });

    const res = NextResponse.redirect(`${process.env.APP_URL}/dashboard/onboarding?step=channels`);
    res.cookies.delete('slack_oauth_state');
    return res;
  } catch (error) {
    console.error('[slack-oauth-callback] installation failed:', error instanceof Error ? error.message : error);
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/onboarding?error=install_failed`);
  }
}
