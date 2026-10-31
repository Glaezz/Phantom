import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const BANNED = [
  "from 'node:",
  'require(',
  "from 'fs'",
  "from 'path'",
  'Buffer',
  'process.',
  'window.',
  'document.',
  'chrome.',
];

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}

describe('runtime portability', () => {
  it('keeps Node and browser-only globals out of src', () => {
    const failures: string[] = [];
    const sourceDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
    for (const file of sourceFiles(sourceDir)) {
      const text = readFileSync(file, 'utf8');
      for (const token of BANNED) {
        if (text.includes(token)) failures.push(`${file}: ${token}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
