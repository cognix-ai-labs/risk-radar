import { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/prisma';
import { encryptSecret, decryptSecret } from '@/lib/encryption';
import type { CreateIssueInput, CreatedIssue, TaskTrackerIntegration } from './types';
import { writeAuditLog } from '@/lib/utils/audit';

/** Minimal GitHub OAuth scope — repo access is required to create issues,
 *  but nothing broader (no org admin, no account-level scopes). */
export const GITHUB_OAUTH_SCOPE = 'repo';

export function buildGitHubInstallUrl(state: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) throw new Error('GITHUB_CLIENT_ID is not set');
  const redirectUri = `${process.env.APP_URL}/api/github/oauth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: GITHUB_OAUTH_SCOPE,
    redirect_uri: redirectUri,
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubOAuthCode(code: string): Promise<{ accessToken: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('GitHub OAuth env vars are not configured');

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`GitHub OAuth exchange failed: ${data.error_description ?? data.error ?? 'unknown error'}`);
  }
  return { accessToken: data.access_token };
}

export async function saveGitHubIntegration(params: {
  workspaceId: string;
  accessToken: string;
  defaultRepo?: string;
}): Promise<void> {
  const octokit = new Octokit({ auth: params.accessToken });
  const { data: user } = await octokit.users.getAuthenticated();

  await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId: params.workspaceId, type: 'GITHUB' } },
    create: {
      workspaceId: params.workspaceId,
      type: 'GITHUB',
      accessToken: encryptSecret(params.accessToken),
      externalAccountId: String(user.id),
      externalAccountName: user.login,
      defaultRepo: params.defaultRepo,
      scope: GITHUB_OAUTH_SCOPE,
    },
    update: {
      accessToken: encryptSecret(params.accessToken),
      externalAccountId: String(user.id),
      externalAccountName: user.login,
      isActive: true,
    },
  });

  await writeAuditLog({ workspaceId: params.workspaceId, action: 'github.connected', metadata: { account: user.login } });
}

export class GitHubIntegration implements TaskTrackerIntegration {
  readonly type = 'GITHUB' as const;

  constructor(
    private readonly octokit: Octokit,
    private readonly repo: string // "owner/name"
  ) {}

  static async forWorkspace(workspaceId: string): Promise<GitHubIntegration> {
    const record = await prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId, type: 'GITHUB' } },
    });
    if (!record || !record.isActive) throw new Error('GitHub is not connected for this workspace');
    if (!record.defaultRepo) throw new Error('No default GitHub repository configured for this workspace');

    const token = decryptSecret(record.accessToken);
    return new GitHubIntegration(new Octokit({ auth: token }), record.defaultRepo);
  }

  async createIssue(input: CreateIssueInput): Promise<CreatedIssue> {
    const [owner, repo] = this.repo.split('/');
    const body = [
      input.description,
      '',
      '**Evidence from Slack:**',
      ...input.evidence.map((e) => `> ${e}`),
      '',
      '**Recommended action:**',
      input.recommendedAction,
      input.slackContextUrl ? `\n[View in Slack](${input.slackContextUrl})` : '',
      '',
      '_Created automatically by Risk Radar._',
    ].join('\n');

    const { data } = await this.octokit.issues.create({ owner, repo, title: input.title, body });
    return { externalId: String(data.number), externalUrl: data.html_url };
  }
}
