const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  'а': 'a',
  'е': 'e',
  'о': 'o',
  'р': 'p',
  'с': 'c',
  'х': 'x',
  'у': 'y',
  'і': 'i',
  'ј': 'j',
  'ѕ': 's',
  'ԁ': 'd',
  // Greek
  'ο': 'o',
  'ν': 'v',
  'ρ': 'p',
  'α': 'a',
  'ε': 'e',
  'ι': 'i',
  'κ': 'k',
  'τ': 't',
};

/** Maps lookalike characters to an ASCII skeleton, then folds common substitutions. */
export function skeleton(label: string): string {
  const mapped = Array.from(label.normalize('NFKC').toLowerCase())
    .map((char) => CONFUSABLES[char] ?? char)
    .join('');

  return mapped
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/5/g, 's')
    .replace(/-/g, '');
}
