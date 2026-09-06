/** Common shape every task-tracker integration (GitHub now; Jira/Linear
 *  later) implements, so risk-engine and API code never need to know which
 *  tracker a workspace has connected. */
export interface CreateIssueInput {
  title: string;
  description: string;
  evidence: string[];
  recommendedAction: string;
  slackContextUrl?: string;
}

export interface CreatedIssue {
  externalId: string;
  externalUrl: string;
}

export interface TaskTrackerIntegration {
  readonly type: 'GITHUB' | 'JIRA' | 'LINEAR';
  createIssue(input: CreateIssueInput): Promise<CreatedIssue>;
}
