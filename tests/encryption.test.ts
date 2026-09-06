import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '@/lib/encryption';

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a plaintext value', () => {
    const plaintext = 'xoxb-fake-slack-token-1234567890';
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same-value');
    const b = encryptSecret('same-value');
    expect(a).not.toBe(b);
  });

  it('fails to decrypt a tampered ciphertext', () => {
    const encrypted = encryptSecret('secret-value');
    const [iv, tag, data] = encrypted.split(':');
    const tampered = `${iv}:${tag}:${data.slice(0, -2)}00`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('throws on malformed input', () => {
    expect(() => decryptSecret('not-a-valid-format')).toThrow();
  });
});
