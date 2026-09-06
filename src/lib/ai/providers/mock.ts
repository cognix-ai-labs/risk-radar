import type { AIProvider, AnalyzableMessage, AnalysisResult, RiskFinding, RiskContextForQA, RiskType } from '../types';

/**
 * Deterministic, keyword-driven provider used for DEMO_MODE and tests.
 * It never calls a network API, so the whole product is explorable without
 * any LLM key. It follows the exact same evidence-grounding contract real
 * providers must: every quote comes verbatim from an input message.
 */

interface Pattern {
  type: RiskType;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  keywords: string[];
  titleFor: (matches: AnalyzableMessage[]) => string;
  descriptionFor: (matches: AnalyzableMessage[]) => string;
  actionsFor: (matches: AnalyzableMessage[]) => string[];
  baseConfidence: number;
}

const PATTERNS: Pattern[] = [
  {
    type: 'blocker',
    severity: 'High',
    keywords: ['blocked', "can't test", 'cannot test', 'not ready', 'stuck', 'broken'],
    titleFor: () => 'Active blocker reported in conversation',
    descriptionFor: (m) =>
      `${m.length} message(s) explicitly describe work that cannot proceed. This is an observed blocker, not a projection — the team stated it directly.`,
    actionsFor: () => ['Assign an owner to the blocker', 'Get a status update within 24h'],
    baseConfidence: 0.85,
  },
  {
    type: 'dependency',
    severity: 'Medium',
    keywords: ['waiting for', 'waiting on', 'pending approval', 'pending review'],
    titleFor: () => 'Work is waiting on an external dependency',
    descriptionFor: (m) =>
      `${m.length} message(s) indicate progress is gated on someone else's action. Inferred risk: if unresolved, downstream work will slip.`,
    actionsFor: () => ['Confirm an ETA from the blocking party', 'Escalate if no response in 48h'],
    baseConfidence: 0.7,
  },
  {
    type: 'deadline_risk',
    severity: 'High',
    keywords: ['move the launch', 'push the deadline', 'miss the deadline', 'delay the release', 'can we move'],
    titleFor: () => 'Deadline may be at risk',
    descriptionFor: (m) =>
      `There is a raised likelihood of delay based on ${m.length} message(s) questioning or challenging the current date. This is an inferred risk based on the surrounding conversation, not a confirmed delay.`,
    actionsFor: () => ['Confirm scope with stakeholders', 'Decide go/no-go explicitly and communicate it'],
    baseConfidence: 0.75,
  },
  {
    type: 'ghost_work',
    severity: 'Medium',
    keywords: ['no ticket', 'not tracked', "there's no ticket", 'spent most of today', 'still debugging', 'trying to reproduce'],
    titleFor: (m) => `${m[0]?.userDisplayName ?? 'Someone'} appears to be doing untracked work`,
    descriptionFor: (m) =>
      `${m[0]?.userDisplayName ?? 'A team member'} describes significant effort with no corresponding ticket mentioned. Confidence reflects that this is inferred from conversation, not confirmed against a task tracker.`,
    actionsFor: () => ['Create a task to track this work'],
    baseConfidence: 0.6,
  },
  {
    type: 'decision_drift',
    severity: 'Medium',
    keywords: ["didn't we already decide", 're-open', 'reopen', 'going back on', 'i thought we agreed'],
    titleFor: () => 'A prior decision appears to be re-opening',
    descriptionFor: (m) =>
      `${m.length} message(s) suggest a decision that was previously made is being revisited without clear resolution. This risks rework and stakeholder confusion.`,
    actionsFor: () => ['Re-confirm the decision explicitly with all stakeholders', 'Document the final decision'],
    baseConfidence: 0.55,
  },
  {
    type: 'customer_issue',
    severity: 'Critical',
    keywords: ['customer is asking', 'customer complained', 'client is upset', 'customer escalation'],
    titleFor: () => 'Customer-facing issue detected',
    descriptionFor: (m) => `${m.length} message(s) indicate direct customer impact — treat as high urgency.`,
    actionsFor: () => ['Notify account owner', 'Prepare customer communication'],
    baseConfidence: 0.8,
  },
  {
    type: 'resource_risk',
    severity: 'Medium',
    keywords: ['only person who', 'overloaded', 'swamped', 'single point of failure'],
    titleFor: () => 'Single point of failure or overload risk',
    descriptionFor: (m) => `${m.length} message(s) suggest one person is a bottleneck or overloaded.`,
    actionsFor: () => ['Cross-train a backup owner', 'Rebalance workload'],
    baseConfidence: 0.6,
  },
];

function matchesKeyword(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  return keywords.find((k) => lower.includes(k)) ?? null;
}

function inferProject(messages: AnalyzableMessage[]): string | null {
  const channel = messages[0]?.channelName;
  if (!channel) return null;
  return channel
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferAffectedPeople(messages: AnalyzableMessage[]): string[] {
  return Array.from(new Set(messages.map((m) => m.userDisplayName))).slice(0, 5);
}

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  async analyzeMessages(messages: AnalyzableMessage[]): Promise<AnalysisResult> {
    const findings: RiskFinding[] = [];

    for (const pattern of PATTERNS) {
      const matched = messages.filter((m) => matchesKeyword(m.text, pattern.keywords));
      if (matched.length === 0) continue;

      const evidence = matched.slice(0, 4).map((m) => {
        const kw = matchesKeyword(m.text, pattern.keywords)!;
        const idx = m.text.toLowerCase().indexOf(kw);
        const start = Math.max(0, idx - 30);
        const end = Math.min(m.text.length, idx + kw.length + 30);
        return { messageId: m.messageId, quote: m.text.slice(start, end).trim() || m.text.slice(0, 120) };
      });

      const confidenceBoost = Math.min(0.15, (matched.length - 1) * 0.05);

      findings.push({
        type: pattern.type,
        severity: pattern.severity,
        confidence: Math.min(0.95, pattern.baseConfidence + confidenceBoost),
        project: inferProject(matched),
        title: pattern.titleFor(matched),
        description: pattern.descriptionFor(matched),
        evidence,
        affectedPeople: inferAffectedPeople(matched),
        affectedDeadline: pattern.type === 'deadline_risk' || pattern.type === 'blocker' ? inferProject(matched) : null,
        recommendedActions: pattern.actionsFor(matched),
      });
    }

    return {
      summary: `Analyzed ${messages.length} message(s) across ${new Set(messages.map((m) => m.channelName)).size} channel(s); found ${findings.length} potential risk(s) (mock provider — no LLM call made).`,
      findings,
    };
  }

  async answerAboutRisks(question: string, context: RiskContextForQA): Promise<string> {
    if (context.risks.length === 0) {
      return `I don't see any active risks for ${context.workspaceName} right now. Run an analysis first with /risk.`;
    }
    const top = [...context.risks].sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 5);
    const lines = top.map(
      (r, i) => `${i + 1}. *${r.title}* (${r.severity}, ${Math.round(r.confidence * 100)}% confidence)${r.project ? ` — ${r.project}` : ''}`
    );
    return `Here's what I'd focus on for "${question}":\n\n${lines.join('\n')}`;
  }
}

function severityRank(s: string): number {
  return { Critical: 3, High: 2, Medium: 1, Low: 0 }[s] ?? 0;
}
