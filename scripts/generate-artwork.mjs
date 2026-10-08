// Original geometric artwork. Node standard library only; no fonts, images or downloads.
// Rasterization, PNG, ICO and ICNS encoders are authored here and deterministic.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { assertAssetEquivalent } from './artwork-equivalence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const layout = JSON.parse(fs.readFileSync(path.join(root, 'docs/assets-dimensions.json'), 'utf8'));
const inventory = [];
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); name.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}
function png(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const scan = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) rgba.copy(scan, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scan, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const colors = { blue: [79, 167, 220], green: [104, 191, 146], purple: [160, 126, 215], red: [224, 111, 109], white: [199, 219, 225], yellow: [220, 180, 98] };
function drawing(name, w, h) {
  const data = Buffer.alloc(w * h * 4);
  const seed = createHash('sha256').update(name).digest();
  const brand = name.includes('icons/') || /(?:logo\d+|icon)\.png$/.test(name);
  const background = /(?:Bg\/|_bg|bg\.png|button|botoncito|hover|underline|line\.png)/i.test(name);
  const colorKey = Object.keys(colors).find(k => name.includes('/' + k + '/'));
  const c = colorKey ? colors[colorKey] : brand ? [105, 198, 180] : Object.values(colors)[seed[0] % 6];
  function pixel(x, y, col, alpha = 255) {
    x = Math.round(x); y = Math.round(y); if (x < 0 || x >= w || y < 0 || y >= h) return;
    const at = (y * w + x) * 4; data[at] = col[0]; data[at + 1] = col[1]; data[at + 2] = col[2]; data[at + 3] = alpha;
  }
  function polygon(points, col, alpha = 255) {
    for (let y = Math.max(0, Math.floor(Math.min(...points.map(p => p[1])))); y <= Math.min(h - 1, Math.ceil(Math.max(...points.map(p => p[1])))); y++) {
      const cuts = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) cuts.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      cuts.sort((a, b) => a - b);
      for (let i = 0; i + 1 < cuts.length; i += 2) for (let x = Math.max(0, Math.ceil(cuts[i])); x <= Math.min(w - 1, Math.floor(cuts[i + 1])); x++) pixel(x, y, col, alpha);
    }
  }
  function disc(cx, cy, r, col, alpha = 255) {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) pixel(x, y, col, alpha);
  }
  function line(ax, ay, bx, by, thickness, col) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= steps; i++) disc(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps, thickness / 2, col);
  }
  if (background || brand) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const delta = Math.floor(5 * (1 - x / w) + 4 * (1 - y / h));
      pixel(x, y, [13 + delta, 21 + delta, 27 + delta]);
    }
  }
  if (background) {
    const gap = Math.max(16, Math.round(Math.min(w, h) / 5));
    for (let x = -h; x < w; x += gap) line(x, h - 1, x + h, 0, 1, [29, 42, 48]);
    line(0, 0, w - 1, 0, 1, [73, 91, 95]); line(0, h - 1, w - 1, h - 1, 1, [45, 61, 67]);
    return data;
  }
  if (name.endsWith('/empty.png')) {
    line(w * .3, h * .5, w * .7, h * .5, Math.max(1, w * .025), [99, 114, 120]); return data;
  }
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * (brand ? .35 : .32);
  const triangle = /\/triangle(?:\/|\.png)/.test(name);
  const round = /\/circle(?:\/|\.png)/.test(name);
  const n = triangle ? 3 : round ? 20 : /\/waning(?:\/|\.png)/.test(name) ? 5 : /\/radial(?:\/|\.png)/.test(name) ? 6 : brand ? 6 : 4 + seed[1] % 4;
  const points = Array.from({ length: n }, (_, i) => [cx + r * Math.cos(-Math.PI / 2 + i * Math.PI * 2 / n), cy + r * Math.sin(-Math.PI / 2 + i * Math.PI * 2 / n)]);
  polygon(points, c);
  polygon(points.map(([x, y]) => [cx + (x - cx) * .70, cy + (y - cy) * .70]), [24, 39, 47]);
  if (brand) {
    polygon([[cx, cy - r * .55], [cx + r * .40, cy], [cx, cy + r * .55], [cx - r * .40, cy]], [209, 232, 223]);
    line(cx, cy - r * .37, cx, cy + r * .37, Math.max(1, r * .05), [52, 119, 112]);
  } else {
    polygon([[cx, cy - r * .4], [cx + r * .35, cy + r * .2], [cx - r * .35, cy + r * .2]], c);
    const ticks = /\/(?:cursed_)?(\d+)\.png$/.exec(name);
    const count = ticks ? Math.min(7, Number(ticks[1])) : 1 + seed[2] % 5;
    for (let i = 0; i < count; i++) disc(cx + (i - (count - 1) / 2) * r * .25, cy + r * 1.3, Math.max(1, r * .04), c);
    if (name.includes('cursed_')) line(cx - r * .75, cy - r * .75, cx + r * .75, cy + r * .75, Math.max(1, r * .06), [232, 220, 203]);
  }
  return data;
}
function output(name, bytes, width, height) {
  const dest = path.join(root, name);
  if (check) {
    if (!fs.existsSync(dest)) throw new Error(`Artwork missing: ${name}`);
    const stored = fs.readFileSync(dest);
    assertAssetEquivalent(name, bytes, stored);
    // Inventory hashes authenticate committed bytes, rather than runtime-specific
    // compression output. Pixel/container validation above proves their origin.
    bytes = stored;
  } else { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes); }
  inventory.push({ path: name, ...(width ? { width, height } : {}), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), origin: 'Original authored geometric drawing; scripts/generate-artwork.mjs' });
}
for (const { path: name, width, height } of layout.assets) output(name, png(width, height, drawing(name, width, height)), width, height);
function ico() {
  const sizes = [16, 32, 48, 64, 128, 256], images = sizes.map(s => png(s, s, drawing('src-tauri/icons/icon.png', s, s)));
  const header = Buffer.alloc(6 + sizes.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((s, i) => { const at = 6 + i * 16; header[at] = s % 256; header[at + 1] = s % 256; header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6); header.writeUInt32LE(images[i].length, at + 8); header.writeUInt32LE(offset, at + 12); offset += images[i].length; });
  return Buffer.concat([header, ...images]);
}
output('public/favicon.ico', ico()); output('src-tauri/icons/icon.ico', ico());
const icnsParts = [[128, 'ic07'], [256, 'ic08'], [512, 'ic09'], [1024, 'ic10']].map(([s, type]) => {
  const image = png(s, s, drawing('src-tauri/icons/icon.png', s, s)), header = Buffer.alloc(8); header.write(type); header.writeUInt32BE(image.length + 8, 4); return Buffer.concat([header, image]);
});
const icnsHeader = Buffer.alloc(8); icnsHeader.write('icns'); icnsHeader.writeUInt32BE(8 + icnsParts.reduce((n, b) => n + b.length, 0), 4);
output('src-tauri/icons/icon.icns', Buffer.concat([icnsHeader, ...icnsParts]));
output('public/assets/mark.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path fill="#69c6b4" d="M64 12 109 38 109 90 64 116 19 90 19 38Z"/><path fill="#18272f" d="M64 27 96 46 96 82 64 101 32 82 32 46Z"/><path fill="#d1e8df" d="M64 38 82 64 64 90 46 64Z"/></svg>\n'));
output('public/manifest.json', Buffer.from(JSON.stringify({ short_name: 'Save Editor Gems', name: 'Bloodborne Save Editor Gems', icons: [{ src: '/favicon.ico', sizes: '16x16 32x32 48x48 64x64 128x128 256x256', type: 'image/x-icon' }, { src: '/logo192.png', sizes: '192x192', type: 'image/png' }, { src: '/logo512.png', sizes: '512x512', type: 'image/png' }], start_url: '.', display: 'standalone', theme_color: '#0d151b', background_color: '#0d151b' }, null, 2) + '\n'));
output('public/robots.txt', Buffer.from('User-agent: *\nDisallow:\n'));
inventory.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const manifest = Buffer.from(JSON.stringify({ generator: 'scripts/generate-artwork.mjs', license: 'GPL-3.0', provenance: 'All artwork newly authored as generic geometric shapes, by Codex for the publication project. Upstream filenames/dimensions are compatibility metadata only. No upstream pixels, fonts, screenshots, game symbols or save data are inputs.', count: inventory.length, assets: inventory }, null, 2) + '\n');
const manifestPath = path.join(root, 'docs/assets-inventory.json');
if (check) { if (!fs.readFileSync(manifestPath).equals(manifest)) throw new Error('Inventory mismatch'); }
else fs.writeFileSync(manifestPath, manifest);
console.log(`${check ? 'Verified authored pixels/structure and committed hashes for' : 'Generated'} ${inventory.length} original assets.`);
