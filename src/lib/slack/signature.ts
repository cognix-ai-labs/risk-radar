import crypto from 'crypto';

const MAX_REQUEST_AGE_SECONDS = 60 * 5;

/**
 * Verifies a Slack request's signature per
 * https://api.slack.com/authentication/verifying-requests-from-slack.
 * Every Slack-facing route (events, commands, interactions) must call this
 * on the raw request body BEFORE parsing it as JSON/form data, and must
 * reject the request outright if verification fails.
 */
export function verifySlackSignature(params: {
  signingSecret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
}): boolean {
  const { signingSecret, timestamp, signature, rawBody } = params;
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_REQUEST_AGE_SECONDS) {
    // Guards against replay attacks with an old, previously-valid signature.
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const expected = `v0=${hmac}`;

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
