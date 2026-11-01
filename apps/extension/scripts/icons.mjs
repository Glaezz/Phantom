import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/phantom-icon.svg', import.meta.url), 'utf8');
const symbol = source.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" rx="60" fill="white"/><svg x="90" y="116" width="220" height="168" viewBox="0 0 186 142">${symbol}</svg></svg>`;
for (const size of [16, 32, 48, 96, 128]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(`../public/icon/${size}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
}
