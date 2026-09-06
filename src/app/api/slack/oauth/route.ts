import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { requireSession } from '@/lib/auth/workspace';
import { buildSlackInstallUrl } from '@/lib/slack/oauth';

/** Starts the Slack install flow for a workspace. The `state` param encodes
 *  which internal workspace this install is for and is verified again in
 *  the callback to prevent a state-fixation / CSRF attack. */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireSession();
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    const state = Buffer.from(JSON.stringify({ workspaceId, userId, nonce: nanoid(16) })).toString('base64url');
    const url = buildSlackInstallUrl(state);

    const res = NextResponse.redirect(url);
    res.cookies.set('slack_oauth_state', state, { httpOnly: true, secure: true, maxAge: 600, sameSite: 'lax' });
    return res;
  } catch (error) {
    console.error('[slack-oauth] failed to start install:', error);
    return NextResponse.json({ error: 'Failed to start Slack install' }, { status: 500 });
  }
}
