const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

(async () => {
  const brand = fs.readFileSync(path.join(__dirname, 'public/phantom-icon.svg'), 'utf8');
  for (const size of [16, 32, 48, 96, 128]) {
    const width = size * 0.55;
    const height = width * 142 / 186;
    const symbol = brand
      .replace('<svg ', `<svg x="${(size - width) / 2}" y="${(size - height) / 2}" `)
      .replace('width="186" height="142"', `width="${width}" height="${height}"`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}" fill="white"/>${symbol}</svg>`;
    const file = path.join(__dirname, `public/icon/${size}.png`);
    await sharp(Buffer.from(svg), { density: 576 }).resize(size, size).png().toFile(file);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, size);
    assert.equal(info.height, size);
    assert.equal(data[3], 0);
    const topCenter = Math.floor(size / 2) * 4;
    assert.deepEqual([...data.subarray(topCenter, topCenter + 4)], [255, 255, 255, 255]);
    console.log(`${size}.png: dimensions, transparent corner, white background checked`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
