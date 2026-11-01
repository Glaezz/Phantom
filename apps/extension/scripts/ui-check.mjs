import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const overlay = await read('entrypoints/overlay.content.css');
const popup = await read('entrypoints/popup/App.css');
const tokens = await read('src/ui/tokens.css');
const buttons = await read('src/ui/components/Button.css');
assert.match(overlay, /:host\s*\{[^}]*font-family: var\(--font-ui\)/s);
assert.match(popup, /html, body, #root\s*\{\s*margin: 0/);
assert.match(popup, /box-sizing: border-box/);
assert.match(buttons, /background: var\(--primary-bg\); color: var\(--primary-fg\)/);
const luminance = (hex) => hex.match(/\w\w/g).map((v) => parseInt(v, 16) / 255)
  .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const dark = tokens.slice(tokens.indexOf('@media (prefers-color-scheme: dark)'));
const color = (name) => dark.match(new RegExp(`--${name}:#([0-9A-Fa-f]{6})`))[1];
for (const background of ['primary-bg', 'primary-hover']) {
  const values = [luminance(color(background)), luminance(color('primary-fg'))].sort((a, b) => b - a);
  assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${background} contrast`);
}
console.log('UI regression checks passed.');
