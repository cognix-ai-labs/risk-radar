import { describe, it, expect, vi } from 'vitest';
import { GitHubIntegration } from '@/lib/integrations/github';

function fakeOctokit(createResponse: any) {
  return { issues: { create: vi.fn().mockResolvedValue({ data: createResponse }) } } as any;
}

describe('GitHubIntegration.createIssue', () => {
  it('creates an issue with title, evidence, and recommended action embedded in the body', async () => {
    const octokit = fakeOctokit({ number: 42, html_url: 'https://github.com/acme/payments/issues/42' });
    const integration = new GitHubIntegration(octokit, 'acme/payments');

    const result = await integration.createIssue({
      title: 'Assign API blocker',
      description: 'High likelihood of delay based on 3 unresolved dependencies.',
      evidence: ['The payment API is still not ready.', "QA can't test because staging is broken."],
      recommendedAction: 'Assign API blocker',
      slackContextUrl: 'https://acme.slack.com/archives/C1/p123',
    });

    expect(result).toEqual({ externalId: '42', externalUrl: 'https://github.com/acme/payments/issues/42' });

    const call = octokit.issues.create.mock.calls[0][0];
    expect(call.owner).toBe('acme');
    expect(call.repo).toBe('payments');
    expect(call.title).toBe('Assign API blocker');
    expect(call.body).toContain('The payment API is still not ready.');
    expect(call.body).toContain('Assign API blocker');
    expect(call.body).toContain('https://acme.slack.com/archives/C1/p123');
    expect(call.body).toContain('Created automatically by Risk Radar');
  });

  it('propagates an error if GitHub API call fails (caller decides fallback behavior)', async () => {
    const octokit = { issues: { create: vi.fn().mockRejectedValue(new Error('GitHub API down')) } } as any;
    const integration = new GitHubIntegration(octokit, 'acme/payments');

    await expect(
      integration.createIssue({ title: 't', description: 'd', evidence: [], recommendedAction: 'a' })
    ).rejects.toThrow('GitHub API down');
  });
});
