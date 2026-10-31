import { describe, expect, it } from 'vitest';
import { isCredentialField, resolveFormTarget } from '../l2';
import { field } from './fixtures/page.fixture';

describe('isCredentialField', () => {
  it('detects password inputs', () => {
    expect(isCredentialField(field({ type: 'password' }))).toBe(true);
  });

  it('detects camelCase OTP names', () => {
    expect(isCredentialField(field({ type: 'text', name: 'otpCode' }))).toBe(true);
  });

  it('does not match substrings', () => {
    expect(isCredentialField(field({ type: 'text', name: 'shipping' }))).toBe(false);
  });

  it('detects one-time-code autocomplete', () => {
    expect(isCredentialField(field({ type: 'text', autocomplete: 'one-time-code' }))).toBe(
      true,
    );
  });
});

describe('resolveFormTarget', () => {
  const page = 'https://login-xyz.top/masuk';

  it('treats empty and hash actions as same-page', () => {
    expect(resolveFormTarget(null, page).kind).toBe('same');
    expect(resolveFormTarget('', page).kind).toBe('same');
    expect(resolveFormTarget('#', page).kind).toBe('same');
  });

  it('treats relative actions on the same domain as same', () => {
    expect(resolveFormTarget('/login', page).kind).toBe('same');
  });

  it('ignores non-http schemes', () => {
    expect(resolveFormTarget('javascript:void(0)', page).kind).toBe('ignored');
  });

  it('detects external targets', () => {
    const target = resolveFormTarget('https://collector.biz.id/post', page);
    expect(target.kind).toBe('external');
    expect(target.host).toBe('collector.biz.id');
  });
});
