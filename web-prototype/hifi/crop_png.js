/* 最小 PNG 裁剪放大工具：纯 node 内置 zlib，无外部依赖。
   支持 8-bit RGB/RGBA 非隔行 PNG。用法: node crop_png.js in.png out.png sx sy sw sh scale */
const fs = require('fs');
const zlib = require('zlib');

function readPNG(path) {
  const buf = fs.readFileSync(path);
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = []; let plte = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'PLTE') plte = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('only 8-bit supported, got ' + bitDepth);
  if (interlace !== 0) throw new Error('interlaced png not supported');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 0 ? 1 : null;
  if (!channels) throw new Error('unsupported colorType ' + colorType);
  if (colorType === 3 && !plte) throw new Error('palette png missing PLTE');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ft = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const rv = raw[rp++];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let v;
      if (ft === 0) v = rv; else if (ft === 1) v = rv + a; else if (ft === 2) v = rv + b;
      else if (ft === 3) v = rv + ((a + b) >> 1); else if (ft === 4) v = rv + paeth(a, b, c);
      else throw new Error('bad filter ' + ft);
      out[y * stride + x] = v & 0xff;
    }
  }
  return { w, h, channels, colorType, plte, data: out };
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const [inp, outp, sx, sy, sw, sh, scale] = process.argv.slice(2);
const img = readPNG(inp);
const x0 = +sx, y0 = +sy, cw = +sw, ch = +sh, sc = +scale || 2;
const ow = cw * sc, oh = ch * sc;
const isPalette = img.colorType === 3;
const outCh = isPalette ? 3 : img.channels; // palette 展开为 RGB
const rows = [];
for (let y = 0; y < oh; y++) {
  const row = Buffer.alloc(ow * outCh + 1); // +1 filter byte
  const srcY = Math.min(img.h - 1, y0 + Math.floor(y / sc));
  for (let x = 0; x < ow; x++) {
    const srcX = Math.min(img.w - 1, x0 + Math.floor(x / sc));
    const si = (srcY * img.w + srcX) * img.channels, di = 1 + x * outCh;
    if (isPalette) {
      const idx = img.data[si];
      row[di] = img.plte[idx * 3]; row[di + 1] = img.plte[idx * 3 + 1]; row[di + 2] = img.plte[idx * 3 + 2];
    } else {
      for (let c = 0; c < outCh; c++) row[di + c] = img.data[si + c];
    }
  }
  rows.push(row);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(ow, 0); ihdr.writeUInt32BE(oh, 4);
ihdr[8] = 8; ihdr[9] = isPalette ? 2 : (img.channels === 4 ? 6 : img.channels === 3 ? 2 : 0); ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(outp, png);
console.log('wrote', outp, ow + 'x' + oh, 'from src', img.w + 'x' + img.h, 'colorType', img.colorType);
