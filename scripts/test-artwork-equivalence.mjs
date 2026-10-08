// Compression portability regression tests. Fixtures are the project's own
// committed geometric assets; variants are made only in memory, never saved.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { inflateSync, deflateSync } from 'node:zlib';
import { assertAssetEquivalent, crc32, pngChunks, icoImages, icnsImages } from './artwork-equivalence.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function chunk(type,data) {
  const bytes=Buffer.alloc(data.length+12); bytes.writeUInt32BE(data.length);
  bytes.write(type,4); data.copy(bytes,8); bytes.writeUInt32BE(crc32(bytes.subarray(4,data.length+8)),data.length+8);
  return bytes;
}
function recompress(png,changePixel=false) {
  const chunks=pngChunks(png);
  const scan=inflateSync(Buffer.concat(chunks.slice(1,-1).map(c=>c.data)));
  assert.equal(scan[0],0,'Authored fixture uses the unfiltered scanline encoder');
  if (changePixel) scan[1]^=1;
  return Buffer.concat([png.subarray(0,8),chunk('IHDR',chunks[0].data),chunk('IDAT',deflateSync(scan,{level:0})),chunk('IEND',Buffer.alloc(0))]);
}
function repackIco(images) {
  const directory=Buffer.alloc(6+images.length*16); directory.writeUInt16LE(1,2); directory.writeUInt16LE(images.length,4);
  let offset=directory.length;
  images.forEach((image,i)=> {const at=6+i*16;image.metadata.copy(directory,at);directory.writeUInt32LE(image.png.length,at+8);directory.writeUInt32LE(offset,at+12);offset+=image.png.length;});
  return Buffer.concat([directory,...images.map(image=>image.png)]);
}
function repackIcns(images) {
  const entries=images.map(image=> {const header=Buffer.alloc(8);header.write(image.type);header.writeUInt32BE(image.png.length+8,4);return Buffer.concat([header,image.png]);});
  const header=Buffer.alloc(8);header.write('icns');header.writeUInt32BE(8+entries.reduce((n,e)=>n+e.length,0),4);
  return Buffer.concat([header,...entries]);
}
let passed=0;
function test(name,run) {run();passed++;console.log(`PASS ${name}`);}
const png=fs.readFileSync(path.join(root,'public/logo192.png'));
test('PNG different compressed bytes preserve authored pixels',()=> {
  const variant=recompress(png);assert(!variant.equals(png));assertAssetEquivalent('logo.png',png,variant);
});
test('PNG changed pixel rejected with valid CRC and zlib stream',()=>assert.throws(()=>assertAssetEquivalent('logo.png',png,recompress(png,true)),/pixels mismatch/));
test('PNG bad CRC and truncation rejected',()=> {
  const bad=Buffer.from(png);bad[bad.length-1]^=1;
  assert.throws(()=>assertAssetEquivalent('logo.png',png,bad),/CRC mismatch/);
  assert.throws(()=>assertAssetEquivalent('logo.png',png,png.subarray(0,-1)),/exceeds file|Truncated/);
});
const ico=fs.readFileSync(path.join(root,'src-tauri/icons/icon.ico'));
test('ICO recompressed embedded PNGs preserve all six sizes',()=> {
  const variant=repackIco(icoImages(ico).map(image=>({...image,png:recompress(image.png)})));
  assert(!variant.equals(ico));assertAssetEquivalent('icon.ico',ico,variant);
});
test('ICO changed embedded pixel rejected',()=> {
  const variant=repackIco(icoImages(ico).map((image,i)=>({...image,png:recompress(image.png,i===0)})));
  assert.throws(()=>assertAssetEquivalent('icon.ico',ico,variant),/pixels mismatch/);
});
test('ICO wrong directory offset rejected',()=> {
  const bad=Buffer.from(ico);bad.writeUInt32LE(bad.readUInt32LE(18)+1,18);
  assert.throws(()=>assertAssetEquivalent('icon.ico',ico,bad),/offset mismatch/);
});
const icns=fs.readFileSync(path.join(root,'src-tauri/icons/icon.icns'));
test('ICNS recompressed embedded PNGs preserve all four types',()=> {
  const variant=repackIcns(icnsImages(icns).map(image=>({...image,png:recompress(image.png)})));
  assert(!variant.equals(icns));assertAssetEquivalent('icon.icns',icns,variant);
});
test('ICNS changed embedded pixel rejected',()=> {
  const variant=repackIcns(icnsImages(icns).map((image,i)=>({...image,png:recompress(image.png,i===0)})));
  assert.throws(()=>assertAssetEquivalent('icon.icns',icns,variant),/pixels mismatch/);
});
test('ICNS wrong total length rejected',()=> {
  const bad=Buffer.from(icns);bad.writeUInt32BE(bad.length-1,4);
  assert.throws(()=>assertAssetEquivalent('icon.icns',icns,bad),/total length mismatch/);
});
test('Non-raster asset bytes still require exact identity',()=>assert.throws(()=>assertAssetEquivalent('mark.svg',Buffer.from('a'),Buffer.from('b')),/bytes mismatch/));
console.log(`${passed} artwork compression-portability regressions passed. Committed assets were not modified.`);
