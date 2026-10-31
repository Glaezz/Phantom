import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('../src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('Workers portability', () => {
  it('does not import Node built-ins or use Node globals', () => {
    const forbidden = [
      /from\s+['"]node:/,
      /import\s*\(\s*['"]node:/,
      /from\s+['"]fs['"]/,
      /from\s+['"]path['"]/,
      /\bBuffer\b/,
      /\bprocess\./,
    ];
    const failures: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      for (const pattern of forbidden) {
        if (pattern.test(source)) failures.push(`${file}: ${pattern}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
