import type { AnalyzableMessage, RiskContextForQA } from './types';

export const RISK_TYPES_GUIDE = `
- blocker: someone is explicitly stuck and cannot proceed
- dependency: work is waiting on another team/person/system
- deadline_risk: signals suggest a date will be missed
- ghost_work: significant effort is visible in conversation but has no
  corresponding ticket/task mentioned anywhere in the messages
- decision_drift: a decision was made, then re-opened or contradicted later
  without clear resolution
- customer_issue: an external customer is impacted or complaining
- resource_risk: understaffing, a single point of failure, or someone
  overloaded is mentioned
`.trim();

export function buildAnalysisSystemPrompt(): string {
  return `You are Risk Radar's analysis engine. You read raw Slack messages from a software team and identify project risks, blockers, untracked ("ghost") work, deadline risk, and decision drift.

Rules you must follow exactly:
1. Output ONLY valid JSON matching the schema you're given. No prose, no markdown fences.
2. Every finding's "evidence" array must cite real "messageId" values from the input and a short verbatim (or near-verbatim) "quote" from that message. Never invent a messageId that wasn't given to you. Never invent a quote that isn't grounded in the actual message text.
3. If you are not confident something is a real risk, either omit it or give it a low "confidence" score (below 0.5). Do not state inferred risk as if it were observed fact.
4. "ghost_work" findings require explicit signal that work is happening AND that no ticket/tracking exists for it — do not guess; if messages don't mention the absence of a ticket, lower your confidence accordingly.
5. Write descriptions the way a careful engineer would: "There is a high likelihood of X based on Y", not "X will happen."
6. Distinguish observed fact (what was literally said) from inferred risk (what you conclude) in the description text.
7. recommendedActions should be short, concrete, assignable actions — not vague advice.

Risk type definitions:
${RISK_TYPES_GUIDE}

Severity guide: Critical = active customer/launch-blocking impact; High = will likely cause a delay or escalation soon; Medium = worth tracking; Low = minor/early signal.`;
}

export function buildAnalysisUserPrompt(messages: AnalyzableMessage[]): string {
  const formatted = messages
    .map((m) => `[id=${m.messageId}] #${m.channelName} ${m.userDisplayName} (${m.postedAt}): ${m.text}`)
    .join('\n');

  return `Analyze the following Slack messages and return JSON with this exact shape:
{
  "summary": string,
  "findings": [
    {
      "type": "blocker" | "dependency" | "deadline_risk" | "ghost_work" | "decision_drift" | "customer_issue" | "resource_risk",
      "severity": "Low" | "Medium" | "High" | "Critical",
      "confidence": number (0 to 1),
      "project": string | null,
      "title": string,
      "description": string,
      "evidence": [{ "messageId": string, "quote": string }],
      "affectedPeople": string[],
      "affectedDeadline": string | null,
      "recommendedActions": string[]
    }
  ]
}

Messages:
${formatted}`;
}

export function buildQAPrompt(question: string, context: RiskContextForQA): { system: string; user: string } {
  const system = `You are Risk Radar answering a question from a team member inside Slack about currently detected risks for workspace "${context.workspaceName}". Answer ONLY using the provided risks — never invent risks, evidence, or numbers that aren't in the list. If asked something the data can't answer, say so plainly. Keep answers concise and suitable for a Slack message (use short paragraphs or bullet points, no heavy markdown headers).`;

  const riskList = context.risks
    .map(
      (r, i) =>
        `${i + 1}. [${r.severity}, ${Math.round(r.confidence * 100)}% confidence] (${r.type}) ${r.title} — ${r.description}${
          r.project ? ` [project: ${r.project}]` : ''
        }\n   Evidence: ${r.evidence.join(' | ')}\n   Recommended: ${r.recommendedActions.join('; ')}`
    )
    .join('\n');

  const user = `Currently detected risks:\n${riskList || '(none currently detected)'}\n\nQuestion: ${question}`;

  return { system, user };
}
