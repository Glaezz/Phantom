import { describe, expect, it } from 'vitest';
import { parseUrl } from '../url';
import { punycodeToUnicode } from '../punycode';
import { damerauLevenshtein } from '../similarity';
import { skeleton } from '../confusables';
import { normalizeText, splitSegments, tokenize, tokenizeIdentifier } from '../text';

describe('punycode', () => {
  it('decodes RFC 3492 labels', () => {
    expect(punycodeToUnicode('xn--bcher-kva')).toBe('bücher');
    expect(punycodeToUnicode('xn--80ak6aa92e')).toBe('аррӏе');
    expect(punycodeToUnicode('example')).toBe('example');
  });
});

describe('similarity', () => {
  it('computes Damerau-Levenshtein distance', () => {
    expect(damerauLevenshtein('ab', 'ba')).toBe(1);
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3);
    expect(damerauLevenshtein('', 'abc')).toBe(3);
    expect(damerauLevenshtein('same', 'same')).toBe(0);
  });
});

describe('text', () => {
  it('normalizes, tokenizes, and splits segments', () => {
    expect(normalizeText('  Café   AU  ')).toBe('cafe au');
    expect(tokenize('Login-BCA.2')).toEqual(['login', 'bca', '2']);
    expect(tokenizeIdentifier('otpCode')).toEqual(['otp', 'code']);
    expect(splitSegments('DANA - Dompet Digital | Indonesia')).toEqual([
      'DANA',
      'Dompet Digital',
      'Indonesia',
    ]);
  });

  it('builds a confusable skeleton', () => {
    expect(skeleton('b\u0441a')).toBe('bca');
    expect(skeleton('b-rnca')).toBe('bmca');
  });
});

describe('parseUrl', () => {
  it('parses a regular official host', () => {
    const parsed = parseUrl('https://www.klikbca.com/login');
    expect(parsed.ok).toBe(true);
    expect(parsed.registeredDomain).toBe('klikbca.com');
    expect(parsed.hostname).toBe('www.klikbca.com');
    expect(parsed.label).toBe('klikbca');
  });

  it('treats my.id as an ICANN suffix, not a private suffix', () => {
    const parsed = parseUrl('https://bca.login.my.id/x');
    expect(parsed.registeredDomain).toBe('login.my.id');
    expect(parsed.publicSuffix).toBe('my.id');
    expect(parsed.isPrivateSuffix).toBe(false);
  });

  it('handles private suffixes', () => {
    const parsed = parseUrl('https://foo.vercel.app');
    expect(parsed.registeredDomain).toBe('foo.vercel.app');
    expect(parsed.publicSuffix).toBe('vercel.app');
    expect(parsed.isPrivateSuffix).toBe(true);
  });

  it('detects IP hosts', () => {
    const parsed = parseUrl('http://192.168.1.1/login');
    expect(parsed.isIp).toBe(true);
    expect(parsed.registeredDomain).toBeNull();
  });

  it('detects userinfo', () => {
    const parsed = parseUrl('https://bca.co.id@evil.example/');
    expect(parsed.hostname).toBe('evil.example');
    expect(parsed.hasUserinfo).toBe(true);
  });

  it('rejects unsupported and empty URLs', () => {
    expect(parseUrl('ftp://x.com').ok).toBe(false);
    expect(parseUrl('').ok).toBe(false);
    expect(parseUrl('not a url').ok).toBe(false);
  });

  it('decodes punycode host labels', () => {
    const parsed = parseUrl('https://xn--bcher-kva.com/');
    expect(parsed.hostnameUnicode).toBe('bücher.com');
    expect(parsed.hasPunycode).toBe(true);
  });
});
