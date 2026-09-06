import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifySlackSignature } from '@/lib/slack/signature';

const SECRET = 'test-signing-secret';

function sign(timestamp: string, body: string, secret = SECRET): string {
  const base = `v0:${timestamp}:${body}`;
  return `v0=${crypto.createHmac('sha256', secret).update(base).digest('hex')}`;
}

describe('verifySlackSignature', () => {
  it('accepts a validly signed, fresh request', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = 'payload=hello';
    const signature = sign(timestamp, rawBody);

    expect(verifySlackSignature({ signingSecret: SECRET, timestamp, signature, rawBody })).toBe(true);
  });

  it('rejects a request signed with the wrong secret', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = 'payload=hello';
    const signature = sign(timestamp, rawBody, 'wrong-secret');

    expect(verifySlackSignature({ signingSecret: SECRET, timestamp, signature, rawBody })).toBe(false);
  });

  it('rejects a tampered body even with a signature that was valid for the original body', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(timestamp, 'payload=original');

    expect(
      verifySlackSignature({ signingSecret: SECRET, timestamp, signature, rawBody: 'payload=tampered' })
    ).toBe(false);
  });

  it('rejects a replayed request with an old timestamp', () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 60 * 10); // 10 minutes old
    const rawBody = 'payload=hello';
    const signature = sign(oldTimestamp, rawBody);

    expect(verifySlackSignature({ signingSecret: SECRET, timestamp: oldTimestamp, signature, rawBody })).toBe(false);
  });

  it('rejects when signature or timestamp is missing', () => {
    expect(verifySlackSignature({ signingSecret: SECRET, timestamp: null, signature: 'v0=abc', rawBody: 'x' })).toBe(false);
    expect(verifySlackSignature({ signingSecret: SECRET, timestamp: '123', signature: null, rawBody: 'x' })).toBe(false);
  });
});
