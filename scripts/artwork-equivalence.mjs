// Compare authored pixels independently of zlib's compressed byte stream.
// Only the formats authored by generate-artwork.mjs are accepted.
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

const signature = Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable = Array.from({length:256}, (_,n) => {
  for (let i=0;i<8;i++) n=(n&1)?0xedb88320^(n>>>1):n>>>1;
  return n>>>0;
});
export function crc32(bytes) {
  let crc=0xffffffff;
  for (const byte of bytes) crc=crcTable[(crc^byte)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
export function pngChunks(bytes) {
  assert(bytes.subarray(0,8).equals(signature),'PNG signature mismatch');
  const chunks=[];
  let at=8;
  while (at<bytes.length) {
    assert(at+12<=bytes.length,'Truncated PNG chunk');
    const size=bytes.readUInt32BE(at), end=at+size+12;
    assert(end<=bytes.length,'PNG chunk exceeds file');
    const type=bytes.toString('ascii',at+4,at+8), data=bytes.subarray(at+8,at+8+size);
    assert.equal(bytes.readUInt32BE(at+8+size),crc32(bytes.subarray(at+4,at+8+size)),`PNG ${type} CRC mismatch`);
    chunks.push({type,data}); at=end;
  }
  assert(chunks.length>=3 && chunks[0].type==='IHDR' && chunks.at(-1).type==='IEND','PNG chunk order mismatch');
  assert.equal(chunks[0].data.length,13,'PNG IHDR length mismatch');
  assert.equal(chunks.at(-1).data.length,0,'PNG IEND must be empty');
  assert(chunks.slice(1,-1).every(chunk=>chunk.type==='IDAT'),'Unexpected PNG chunk');
  return chunks;
}
function paeth(a,b,c) {
  const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c);
  return pa<=pb && pa<=pc?a:pb<=pc?b:c;
}
export function decodePng(bytes) {
  const chunks=pngChunks(bytes), header=chunks[0].data;
  const width=header.readUInt32BE(0), height=header.readUInt32BE(4);
  assert(width>0 && height>0 && width*height<=16_777_216,'PNG dimensions unsupported');
  assert.equal(header[8],8,'Expected 8-bit PNG'); assert.equal(header[9],6,'Expected RGBA PNG');
  assert.equal(header[10],0,'Unsupported PNG compression'); assert.equal(header[11],0,'Unsupported PNG filtering');
  assert.equal(header[12],0,'Interlaced PNG unsupported');
  const stride=width*4, expected=(stride+1)*height;
  const scan=inflateSync(Buffer.concat(chunks.slice(1,-1).map(chunk=>chunk.data)),{maxOutputLength:expected});
  assert.equal(scan.length,expected,'PNG scanline length mismatch');
  const pixels=Buffer.alloc(stride*height);
  for (let y=0;y<height;y++) {
    const filter=scan[y*(stride+1)]; assert(filter<=4,'Unsupported PNG scanline filter');
    for (let x=0;x<stride;x++) {
      const left=x>=4?pixels[y*stride+x-4]:0, above=y?pixels[(y-1)*stride+x]:0;
      const upperLeft=y && x>=4?pixels[(y-1)*stride+x-4]:0;
      const prediction=filter===0?0:filter===1?left:filter===2?above:filter===3?Math.floor((left+above)/2):paeth(left,above,upperLeft);
      pixels[y*stride+x]=(scan[y*(stride+1)+1+x]+prediction)&255;
    }
  }
  return {width,height,header,pixels};
}
export function icoImages(bytes) {
  assert(bytes.length>=6,'Truncated ICO header');
  assert.equal(bytes.readUInt16LE(0),0,'ICO reserved field mismatch');
  assert.equal(bytes.readUInt16LE(2),1,'Expected ICO icon type');
  const count=bytes.readUInt16LE(4); assert(count>0 && count<=256,'ICO count unsupported');
  let cursor=6+count*16; assert(cursor<=bytes.length,'Truncated ICO directory');
  const images=[];
  for (let i=0;i<count;i++) {
    const at=6+i*16, length=bytes.readUInt32LE(at+8), offset=bytes.readUInt32LE(at+12);
    assert.equal(offset,cursor,'ICO payload order/offset mismatch'); assert(length>0 && offset+length<=bytes.length,'ICO payload exceeds file');
    const metadata=bytes.subarray(at,at+8), png=bytes.subarray(offset,offset+length), decoded=decodePng(png);
    assert.equal(metadata[2],0,'Expected true-color ICO'); assert.equal(metadata[3],0,'ICO directory reserved field mismatch');
    assert.equal(metadata.readUInt16LE(4),1,'ICO plane count mismatch'); assert.equal(metadata.readUInt16LE(6),32,'Expected RGBA ICO');
    assert.equal(decoded.width,metadata[0]||256,'ICO embedded width mismatch');
    assert.equal(decoded.height,metadata[1]||256,'ICO embedded height mismatch');
    images.push({metadata,png,decoded}); cursor+=length;
  }
  assert.equal(cursor,bytes.length,'Unexpected trailing ICO data');
  return images;
}
export function icnsImages(bytes) {
  assert(bytes.length>=8 && bytes.toString('ascii',0,4)==='icns','ICNS header mismatch');
  assert.equal(bytes.readUInt32BE(4),bytes.length,'ICNS total length mismatch');
  const sizes={ic07:128,ic08:256,ic09:512,ic10:1024}, seen=new Set(), images=[];
  let cursor=8;
  while (cursor<bytes.length) {
    assert(cursor+8<=bytes.length,'Truncated ICNS entry');
    const type=bytes.toString('ascii',cursor,cursor+4), length=bytes.readUInt32BE(cursor+4);
    assert(sizes[type] && !seen.has(type),'Unexpected or duplicate ICNS type');
    assert(length>8 && cursor+length<=bytes.length,'ICNS payload exceeds file');
    const png=bytes.subarray(cursor+8,cursor+length), decoded=decodePng(png);
    assert.equal(decoded.width,sizes[type],'ICNS embedded width mismatch'); assert.equal(decoded.height,sizes[type],'ICNS embedded height mismatch');
    images.push({type,png,decoded}); seen.add(type); cursor+=length;
  }
  assert(images.length>0,'Empty ICNS container');
  return images;
}
function equalPixels(expected,actual,name) {
  assert(expected.header.equals(actual.header),`PNG structure mismatch: ${name}`);
  assert(expected.pixels.equals(actual.pixels),`PNG pixels mismatch: ${name}`);
}
export function assertAssetEquivalent(name,expected,actual) {
  if (name.endsWith('.png')) equalPixels(decodePng(expected),decodePng(actual),name);
  else if (name.endsWith('.ico')) {
    const a=icoImages(expected),b=icoImages(actual); assert.equal(a.length,b.length,`ICO image count mismatch: ${name}`);
    a.forEach((image,i)=> {assert(image.metadata.equals(b[i].metadata),`ICO directory mismatch: ${name}`);equalPixels(image.decoded,b[i].decoded,`${name} image ${i}`);});
  } else if (name.endsWith('.icns')) {
    const a=icnsImages(expected),b=icnsImages(actual); assert.equal(a.length,b.length,`ICNS image count mismatch: ${name}`);
    a.forEach((image,i)=> {assert.equal(image.type,b[i].type,`ICNS entry type/order mismatch: ${name}`);equalPixels(image.decoded,b[i].decoded,`${name} ${image.type}`);});
  } else assert(expected.equals(actual),`Asset bytes mismatch: ${name}`);
}
