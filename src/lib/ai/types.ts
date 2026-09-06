export type RiskType =
  | 'blocker'
  | 'dependency'
  | 'deadline_risk'
  | 'ghost_work'
  | 'decision_drift'
  | 'customer_issue'
  | 'resource_risk';

export type RiskSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

/** One Slack message as fed into the analysis engine, with a stable id the
 *  AI can cite back as evidence — this id is how we enforce "never
 *  fabricate evidence": any evidence not resolving to a real messageId in
 *  the input batch is dropped before the finding is persisted. */
export interface AnalyzableMessage {
  messageId: string;
  channelName: string;
  userDisplayName: string;
  text: string;
  postedAt: string; // ISO timestamp
  permalink?: string;
}

export interface RiskEvidenceInput {
  messageId: string;
  quote: string;
}

export interface RiskFinding {
  type: RiskType;
  severity: RiskSeverity;
  confidence: number; // 0..1
  project: string | null;
  title: string;
  description: string;
  evidence: RiskEvidenceInput[];
  affectedPeople: string[];
  affectedDeadline: string | null;
  recommendedActions: string[];
}

export interface AnalysisResult {
  findings: RiskFinding[];
  /** Short human-readable summary of what was analyzed, for logging/UI. */
  summary: string;
}

export interface AIProvider {
  readonly name: string;
  /** Analyze a batch of messages and return structured, evidence-grounded findings. */
  analyzeMessages(messages: AnalyzableMessage[]): Promise<AnalysisResult>;
  /** Answer a natural-language question about already-detected risks (for
   *  @RiskRadar mentions) — grounded in the risks passed in, not free chat. */
  answerAboutRisks(question: string, context: RiskContextForQA): Promise<string>;
}

export interface RiskContextForQA {
  workspaceName: string;
  risks: Array<{
    id: string;
    type: RiskType;
    severity: RiskSeverity;
    confidence: number;
    title: string;
    description: string;
    project: string | null;
    evidence: string[];
    recommendedActions: string[];
  }>;
}
