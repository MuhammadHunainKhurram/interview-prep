/**
 * Draws the extension icon (purple rounded square with a check mark) as PNGs in
 * public/icon/. No image dependencies: pixels are rasterized with 4x4 supersampling
 * and encoded with node:zlib.
 *
 * Usage: npx tsx scripts/generate-icons.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icon');
const SIZES = [16, 32, 48, 128];
const ACCENT = [0xce, 0x82, 0xff];
const SHADE = [0xa3, 0x5f, 0xd6];
const MARK = [0xff, 0xff, 0xff];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // no filter
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundedRect(
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
): boolean {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Color of a point in unit coordinates (0..1), or null for transparent. */
function sample(u: number, v: number): number[] | null {
  if (!inRoundedRect(u, v, 0.02, 0.02, 0.98, 0.98, 0.22)) return null;
  const check: [number, number][] = [
    [0.27, 0.5],
    [0.43, 0.66],
    [0.74, 0.34],
  ];
  const d = Math.min(
    distToSegment(u, v, ...check[0]!, ...check[1]!),
    distToSegment(u, v, ...check[1]!, ...check[2]!),
  );
  if (d < 0.085) return MARK;
  return v > 0.9 ? SHADE : ACCENT;
}

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const rgba = new Uint8Array(size * size * 4);
  const ss = 4;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          if (!c) continue;
          acc[0]! += c[0]!;
          acc[1]! += c[1]!;
          acc[2]! += c[2]!;
          acc[3]! += 1;
        }
      const i = (y * size + x) * 4;
      const n = acc[3]!;
      if (n > 0) {
        rgba[i] = Math.round(acc[0]! / n);
        rgba[i + 1] = Math.round(acc[1]! / n);
        rgba[i + 2] = Math.round(acc[2]! / n);
      }
      rgba[i + 3] = Math.round((n / (ss * ss)) * 255);
    }
  writeFileSync(resolve(OUT, `${size}.png`), png(size, rgba));
}
console.log(`Wrote ${SIZES.map((s) => `${s}.png`).join(', ')} to ${OUT}`);
