const zlib = require('zlib');

/** PNG real (escala de cinza) com um traço — como o gerado pelo canvas de assinatura. */
function png(w = 400, h = 150) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h, 255);
  for (let x = 20; x < w - 20; x++) { const y = Math.round(h / 2 + Math.sin(x / 15) * 30); raw[y * (w + 1) + 1 + x] = 0; raw[(y * (w + 1)) - (y > 0 ? 0 : 0)] = 0; }
  for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

module.exports = { png };
