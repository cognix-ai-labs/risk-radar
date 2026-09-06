import { describe, it, expect } from 'vitest';
import { classifyMentionIntent } from '@/lib/slack/mentions';

describe('classifyMentionIntent', () => {
  it('classifies "what do I need to worry about today?"', () => {
    expect(classifyMentionIntent('what do I need to worry about today?')).toBe('what_to_worry_about');
  });

  it('classifies "explain this risk"', () => {
    expect(classifyMentionIntent('explain this risk')).toBe('explain_risk');
  });

  it('classifies task-creation phrasing variants', () => {
    expect(classifyMentionIntent('create a task')).toBe('create_task');
    expect(classifyMentionIntent('please make a task for this')).toBe('create_task');
    expect(classifyMentionIntent('can you open a task?')).toBe('create_task');
  });

  it('falls back to unknown for unrelated text (never a hard failure)', () => {
    expect(classifyMentionIntent('good morning team')).toBe('unknown');
  });
});
