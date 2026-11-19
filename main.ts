// THE WORLD TODAY — Thursday 19 November 2026, drawn entirely in code.
// A newspaper front page summing up the day's world news: GTA VI launches
// in Vice City, the Trump–Xi–Putin summit in Shenzhen, Anthropic's record
// $81.3bn IPO, Israeli troops crossing the Gaza ceasefire line, the Crimean
// Bridge hit again, and Voyager 1 reaching one light-day from home.
// Node 22, standard library only (fs, path, zlib). No network, no
// randomness: two runs are byte-identical. Writes one 1024x1024 PNG to
// $MAKEFUN_OUTPUT_DIR/entry.png (default /output/entry.png).
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [245, 239, 224];
const INK: RGB = [17, 17, 17];
const RED: RGB = [200, 16, 46];
const WHITE: RGB = [255, 255, 255];
const GOLD: RGB = [245, 183, 66];
const PINK: RGB = [255, 46, 136];
const CYAN: RGB = [41, 230, 255];

// ---- 5x7 bitmap font, drawn by hand. Each glyph is 7 rows of 5 cells,
// '#' = ink, '.' = empty. Covers A-Z, 0-9 and the punctuation this page uses.
const GLYPHS: Record<string, string> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.####/#..../#..../#..../#..../#..../.####',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.####/#..../#..../#.###/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#..##/#.#.#/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '####./....#/....#/.###./....#/....#/####.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '.###./#..../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./...#./..#../..#../..#..',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/....#/.###.',
  ' ': '...../...../...../...../...../...../.....',
  '.': '...../...../...../...../...../.##../.##..',
  ',': '...../...../...../...../.##../.##../.#...',
  ':': '...../.##../.##../...../.##../.##../.....',
  ';': '...../.##../.##../...../.##../.##../.#...',
  "'": '..#../..#../.#.../...../...../...../.....',
  '-': '...../...../...../.###./...../...../.....',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  $: '..#../.####/#.#../.###./..#.#/####./..#..',
  '%': '##..#/##.#./...#./..#../.#.../#.##./#..##',
  '&': '.##../#..#./#..#./.#.../#.#.#/#..#./.##.#',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...',
  '/': '....#/...#./..#../..#../.#.../.#.../#....',
  '+': '...../..#../..#../.###./..#../..#../.....',
  '=': '...../...../.###./...../.###./...../.....',
  '"': '.#.#./.#.#./...../...../...../...../.....',
  '•': '...../.###./.###./.###./...../...../.....',
};

// Normalise lookalike punctuation onto the glyphs above.
function glyphFor(ch: string): string {
  if (ch === '—' || ch === '–') return '-';
  if (ch === '’' || ch === '‘') return "'";
  return ch;
}

function glyphRows(ch: string): string[] {
  const g = GLYPHS[glyphFor(ch)] ?? GLYPHS['?'];
  return g.split('/');
}

// ---- Pixel primitives on the RGB buffer ----
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) px(xx, yy, c);
  }
}
function hline(x: number, y: number, len: number, c: RGB): void {
  for (let i = 0; i < len; i++) px(x + i, y, c);
}
function vline(x: number, y: number, len: number, c: RGB): void {
  for (let i = 0; i < len; i++) px(x, y + i, c);
}
// Bresenham line.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  for (let i = 0; i < t; i++) line(x0, y0 + i, x1, y1 + i, c);
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = -r; yy <= r; yy++) {
    const dx = Math.floor(Math.sqrt(r * r - yy * yy));
    hline(cx - dx, cy + yy, dx * 2 + 1, c);
  }
}
function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      px(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
    }
  }
}
// Filled triangle (scanline).
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.max(0, Math.min(y0, y1, y2)), maxY = Math.min(H - 1, Math.max(y0, y1, y2));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: [number, number, number, number][] = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const a = Math.min(...xs), b = Math.max(...xs);
      hline(Math.round(a), y, Math.round(b) - Math.round(a) + 1, c);
    }
  }
}
// Vertical gradient between colour stops [[0..1, colour], ...].
function vgrad(x: number, y: number, w: number, h: number, stops: [number, RGB][]): void {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    const f = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const c: RGB = [
      Math.round(c0[0] + (c1[0] - c0[0]) * f),
      Math.round(c0[1] + (c1[1] - c0[1]) * f),
      Math.round(c0[2] + (c1[2] - c0[2]) * f),
    ];
    hline(x, y + yy, w, c);
  }
}

// Fixed-seed deterministic pseudo-random (LCG) — same numbers every run.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

// ---- Text ----
function charAdvance(scale: number): number {
  return 5 * scale + 1;
}
function textWidth(s: string, scale: number): number {
  return s.length * charAdvance(scale) - 1;
}
function drawChar(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const rows = glyphRows(ch);
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (rows[r][col] === '#') rect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}
function text(s: string, x: number, y: number, scale: number, c: RGB, align: 'left' | 'center' | 'right' = 'left'): void {
  let start = x;
  if (align === 'center') start = x - Math.floor(textWidth(s, scale) / 2);
  if (align === 'right') start = x - textWidth(s, scale);
  for (let i = 0; i < s.length; i++) drawChar(s[i], start + i * charAdvance(scale), y, scale, c);
}
function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : cur + ' ' + w;
    if (textWidth(next, scale) <= maxW || cur === '') cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---- Minimal PNG encoder (8-bit RGB, per-row best filter, zlib level 9) ----
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
function encodePNG(): Buffer {
  const stride = W * 3;
  const raw = Buffer.alloc(H * (1 + stride));
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < H; y++) {
    const row = Buffer.from(buf.subarray(y * stride, (y + 1) * stride));
    const cands: Buffer[] = [];
    for (let f = 0; f <= 4; f++) {
      const out = Buffer.alloc(stride);
      for (let i = 0; i < stride; i++) {
        const left = i >= 3 ? row[i - 3] : 0;
        const up = prev[i];
        const upLeft = i >= 3 ? prev[i - 3] : 0;
        let pred = 0;
        if (f === 1) pred = left;
        else if (f === 2) pred = up;
        else if (f === 3) pred = Math.floor((left + up) / 2);
        else if (f === 4) pred = paeth(left, up, upLeft);
        out[i] = (row[i] - pred) & 0xff;
      }
      cands.push(out);
    }
    let best = 0, bestScore = Infinity;
    for (let f = 0; f <= 4; f++) {
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const v = cands[f][i];
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) { bestScore = score; best = f; }
    }
    raw[y * (1 + stride)] = best;
    cands[best].copy(raw, y * (1 + stride) + 1);
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Scenes ----

// A palm tree silhouette: trunk + fronds, drawn with thick lines.
function palm(x: number, y: number, h: number, lean: number, c: RGB): void {
  const topX = x + lean, topY = y - h;
  thickLine(x, y, topX, topY, 4, c);
  const fronds: [number, number][] = [[-34, 6], [-24, -14], [-8, -22], [10, -20], [26, -10], [36, 8]];
  for (const [dx, dy] of fronds) {
    line(topX, topY, topX + dx, topY + dy, c);
    line(topX, topY, topX + dx, topY + dy + 8, c);
  }
  circle(topX, topY, 5, c);
}

// Lead scene: Vice City at sunset — gradient sky, sun, neon skyline,
// palm trees, waterfront road with a car. x,y,w,h is the scene box.
function drawLeadScene(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, Math.floor(h * 0.62), [
    [0, [43, 27, 74]],
    [0.45, [123, 45, 139]],
    [0.8, [232, 93, 61]],
    [1, [245, 169, 66]],
  ]);
  const horizon = y + Math.floor(h * 0.62);
  // Sun with halo.
  circle(x + Math.floor(w * 0.72), horizon - 52, 58, [245, 169, 66]);
  circle(x + Math.floor(w * 0.72), horizon - 52, 44, [255, 233, 168]);
  // Birds.
  const bird: RGB = [22, 15, 46];
  for (const [bx, by, s] of [[0.2, 0.16, 10], [0.3, 0.11, 8], [0.55, 0.2, 9]] as const) {
    const px0 = x + Math.floor(w * bx), py0 = y + Math.floor(h * by);
    line(px0 - s, py0, px0, py0 - 5, bird);
    line(px0, py0 - 5, px0 + s, py0, bird);
  }
  // Skyline: dark towers with lit windows, deterministic.
  const rnd = lcg(190706);
  const base = horizon;
  let bx = x + 8;
  const towers: [number, number, number][] = [];
  while (bx < x + w - 40) {
    const tw = 34 + Math.floor(rnd() * 46);
    const th = 40 + Math.floor(rnd() * 110);
    towers.push([bx, tw, th]);
    bx += tw + 6;
  }
  for (const [tx, tw, th] of towers) {
    rect(tx, base - th, tw, th, [22, 15, 46]);
    // Rooftop beacon on the tallest towers.
    if (th > 110) circle(tx + Math.floor(tw / 2), base - th - 4, 3, RED);
    for (let wy = base - th + 8; wy < base - 8; wy += 14) {
      for (let wx = tx + 6; wx < tx + tw - 6; wx += 12) {
        if (rnd() < 0.45) rect(wx, wy, 5, 7, rnd() < 0.7 ? [255, 215, 106] : [127, 231, 242]);
      }
    }
  }
  // Neon billboard: VICE CITY.
  const bbX = x + Math.floor(w * 0.36), bbY = y + 18, bbW = 268, bbH = 62;
  rect(bbX, bbY, bbW, bbH, [16, 10, 34]);
  rect(bbX, bbY, bbW, 3, PINK);
  rect(bbX, bbY + bbH - 3, bbW, 3, PINK);
  text('VICE CITY', bbX + bbW / 2, bbY + 16, 4, [255, 122, 184], 'center');
  text('VICE CITY', bbX + bbW / 2, bbY + 14, 4, PINK, 'center');
  // Sea.
  vgrad(x, horizon, w, h - Math.floor(h * 0.62), [[0, [14, 77, 100]], [1, [8, 48, 63]]]);
  // Sun reflection streaks on the water.
  const sx = x + Math.floor(w * 0.72);
  for (let i = 0; i < 7; i++) {
    const rw = 90 - i * 10;
    hline(sx - Math.floor(rw / 2), horizon + 8 + i * 9, rw, [255, 214, 130]);
  }
  // Waterfront road + car silhouette at the bottom.
  rect(x, y + h - 26, w, 26, [26, 26, 34]);
  hline(x, y + h - 26, w, [255, 215, 106]);
  const carX = x + Math.floor(w * 0.16), carY = y + h - 24;
  rect(carX, carY - 8, 74, 10, [12, 12, 18]);
  rect(carX + 16, carY - 18, 40, 11, [12, 12, 18]);
  circle(carX + 16, carY + 2, 6, [5, 5, 8]);
  circle(carX + 58, carY + 2, 6, [5, 5, 8]);
  circle(carX + 72, carY - 4, 3, [255, 240, 160]);
  // Palms framing the scene.
  palm(x + 26, y + h - 26, 96, 14, [20, 14, 36]);
  palm(x + w - 30, y + h - 26, 110, -16, [20, 14, 36]);
}

// Summit scene: three flags (US, China, Russia) above a handshake.
function drawSummit(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [220, 239, 247]);
  const fw = Math.floor((w - 16) / 3), fh = 34, fy = y + 10;
  // US flag: stripes + canton.
  const usX = x + 6;
  for (let i = 0; i < 7; i++) rect(usX, fy + i * 5, fw, 5, i % 2 === 0 ? [178, 34, 52] : WHITE);
  rect(usX, fy, Math.floor(fw * 0.45), 20, [60, 59, 110]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) circle(usX + 4 + c * 6, fy + 4 + r * 6, 1, WHITE);
  // China flag: red field, gold stars.
  const cnX = usX + fw + 2;
  rect(cnX, fy, fw, fh, [222, 41, 16]);
  circle(cnX + 9, fy + 9, 4, GOLD);
  for (const [sx, sy] of [[24, 6], [30, 12], [28, 20], [20, 22]] as const) circle(cnX + sx, fy + sy, 2, GOLD);
  // Russia flag: white / blue / red bands.
  const ruX = cnX + fw + 2;
  rect(ruX, fy, fw, 11, WHITE);
  rect(ruX, fy + 11, fw, 12, [0, 57, 166]);
  rect(ruX, fy + 23, fw, 11, [213, 0, 50]);
  // Handshake: two forearms meeting at the centre.
  const cy = y + h - 34, cx = x + Math.floor(w / 2);
  thickLine(x + 8, y + h - 8, cx - 8, cy, 7, [233, 196, 168]);
  thickLine(x + w - 8, y + h - 8, cx + 8, cy, 7, [210, 172, 140]);
  circle(cx, cy, 10, [233, 196, 168]);
  circle(cx, cy, 6, [200, 160, 128]);
  // Green carpet strip.
  rect(x, y + h - 8, w, 8, [31, 120, 70]);
}

// IPO scene: a rising chart on a dark board, gold coins, a big $.
function drawIPO(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [11, 46, 31]);
  // Grid lines.
  for (let i = 1; i < 4; i++) hline(x + 8, y + Math.floor((h * i) / 4), w - 16, [28, 84, 60]);
  // Rising chart.
  const pts: [number, number][] = [
    [0.08, 0.82], [0.24, 0.74], [0.36, 0.78], [0.52, 0.58], [0.66, 0.5], [0.8, 0.3], [0.94, 0.12],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    thickLine(
      x + Math.floor(w * pts[i][0]), y + Math.floor(h * pts[i][1]),
      x + Math.floor(w * pts[i + 1][0]), y + Math.floor(h * pts[i + 1][1]), 4, [46, 230, 107],
    );
  }
  const [ax, ay] = pts[pts.length - 1];
  tri(
    x + Math.floor(w * ax), y + Math.floor(h * ay) - 12,
    x + Math.floor(w * ax) - 4, y + Math.floor(h * ay) + 2,
    x + Math.floor(w * ax) + 12, y + Math.floor(h * ay) + 2, [46, 230, 107],
  );
  // Gold coins stacked bottom-left.
  for (let i = 0; i < 3; i++) {
    circle(x + 22 + i * 16, y + h - 18 - i * 4, 9, GOLD);
    circle(x + 22 + i * 16, y + h - 18 - i * 4, 5, [255, 220, 120]);
  }
  text('$', x + w - 34, y + 8, 5, GOLD);
}

// Gaza scene: sand ground, a cracked wall, a dashed ceasefire line
// crossed by a red arrow, rain falling.
function drawGaza(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [232, 217, 176]);
  // Rain.
  const rnd = lcg(191119);
  for (let i = 0; i < 14; i++) {
    const rx = x + 6 + Math.floor(rnd() * (w - 12));
    const ry = y + 6 + Math.floor(rnd() * 40);
    line(rx, ry, rx - 3, ry + 9, [70, 130, 180]);
  }
  // Dashed ceasefire line down the middle.
  for (let yy = y + 6; yy < y + h - 6; yy += 12) vline(x + Math.floor(w / 2), yy, 7, [200, 16, 46]);
  // Cracked wall across the lower half.
  rect(x + 8, y + 78, w - 16, 34, [150, 148, 140]);
  rect(x + 8, y + 78, w - 16, 4, [110, 108, 100]);
  const crackX = x + Math.floor(w * 0.42);
  line(crackX, y + 78, crackX + 8, y + 92, INK);
  line(crackX + 8, y + 92, crackX - 4, y + 104, INK);
  line(crackX - 4, y + 104, crackX + 6, y + 112, INK);
  // Red arrow crossing the line, left to right.
  const ay = y + 56;
  thickLine(x + 14, ay, x + w - 34, ay, 4, RED);
  tri(x + w - 34, ay - 8, x + w - 34, ay + 8, x + w - 12, ay, RED);
  // Aid crates.
  rect(x + w - 40, y + h - 26, 14, 12, [120, 90, 40]);
  rect(x + w - 24, y + h - 22, 12, 8, [140, 108, 52]);
}

// Crimean Bridge scene: sky, sea, a bridge with two towers, a blast.
function drawBridge(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, Math.floor(h * 0.55), [[0, [207, 228, 245]], [1, [160, 198, 228]]]);
  rect(x, y + Math.floor(h * 0.55), w, h - Math.floor(h * 0.55), [46, 111, 163]);
  // Wave lines.
  for (let i = 0; i < 4; i++) {
    const wy = y + Math.floor(h * 0.6) + i * 12;
    for (let wx = x + 8 + (i % 2) * 14; wx < x + w - 20; wx += 28) hline(wx, wy, 16, [120, 180, 220]);
  }
  const deckY = y + Math.floor(h * 0.52);
  // Towers + deck + cables.
  rect(x + 34, deckY - 46, 8, 46, [90, 90, 96]);
  rect(x + w - 42, deckY - 46, 8, 46, [90, 90, 96]);
  rect(x + 6, deckY, w - 12, 7, [70, 70, 76]);
  line(x + 38, deckY - 46, x + Math.floor(w / 2), deckY, [70, 70, 76]);
  line(x + w - 38, deckY - 46, x + Math.floor(w / 2), deckY, [70, 70, 76]);
  // Blast starburst above the deck.
  const bx = x + Math.floor(w / 2), by = deckY - 22;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    line(bx, by, Math.round(bx + 26 * Math.cos(a)), Math.round(by + 26 * Math.sin(a)), [255, 157, 0]);
  }
  circle(bx, by, 12, [255, 210, 63]);
  circle(bx, by, 6, [255, 240, 160]);
  // Smoke.
  circle(bx - 18, by - 18, 8, [120, 120, 120]);
  circle(bx + 20, by - 22, 10, [140, 140, 140]);
}

// A news panel: border, scene on the left, headline + body on the right.
function panel(x: number, y: number, w: number, h: number, scene: (x: number, y: number, w: number, h: number) => void, headline: string, body: string): void {
  rect(x, y, w, h, PAPER);
  rect(x, y, w, 2, INK);
  rect(x, y + h - 2, w, 2, INK);
  rect(x, y, 2, h, INK);
  rect(x + w - 2, y, 2, h, INK);
  const sw = 146;
  scene(x + 4, y + 4, sw, h - 8);
  const tx = x + 4 + sw + 10;
  const tw = x + w - 8 - tx;
  const headLines = wrap(headline, tw, 3);
  let ty = y + 12;
  for (const ln of headLines) { text(ln, tx, ty, 3, INK); ty += 23; }
  ty += 4;
  for (const ln of wrap(body, tw, 2)) { text(ln, tx, ty, 2, [60, 60, 60]); ty += 15; }
}

// ---- Page layout ----
function drawPage(): void {
  rect(0, 0, W, H, PAPER);
  const CX = 512;

  // Masthead.
  text('THE WORLD TODAY', CX, 22, 7, INK, 'center');
  rect(32, 80, 960, 4, RED);
  text('THURSDAY 19 NOVEMBER 2026', CX, 92, 4, RED, 'center');
  rect(32, 128, 960, 3, INK);
  text('WORLD NEWS IN PICTURES — ONE DAY, ONE PAGE', CX, 136, 2, INK, 'center');
  rect(32, 154, 960, 6, INK);

  // Lead story: GTA VI.
  text('GTA VI IS HERE', CX, 170, 6, INK, 'center');
  drawLeadScene(32, 218, 960, 282);
  text('GAMERS ENTER VICE CITY AS GRAND THEFT AUTO VI', CX, 510, 2, INK, 'center');
  text('BEGINS ITS GLOBAL ROLLOUT — AFTER A 13-YEAR WAIT', CX, 526, 2, INK, 'center');
  rect(32, 552, 960, 3, INK);

  // Panel rows.
  panel(32, 566, 471, 150, drawSummit, 'TRUMP, XI AND PUTIN MEET IN SHENZHEN', 'TRILATERAL TALKS AT APEC 2026');
  panel(521, 566, 471, 150, drawIPO, "ANTHROPIC'S RECORD $81.3BN IPO — BIGGEST EVER", 'SHARES PRICED $83');
  panel(32, 730, 471, 150, drawGaza, 'ISRAELI TROOPS CROSS CEASEFIRE LINE', 'AID PLEA AS FLOODS DISPLACE 46,000');
  panel(521, 730, 471, 150, drawBridge, 'CRIMEAN BRIDGE HIT AGAIN', 'TRAFFIC SUSPENDED AFTER NEW ATTACK');

  // Voyager band: black space, stars, the probe, headline.
  const bandY = 894, bandH = 74;
  rect(32, bandY, 960, bandH, [8, 8, 16]);
  const stars = lcg(19761119);
  for (let i = 0; i < 46; i++) {
    const sx = 36 + Math.floor(stars() * 952);
    const sy = bandY + 4 + Math.floor(stars() * (bandH - 8));
    const s = stars();
    px(sx, sy, s < 0.7 ? WHITE : [255, 220, 130]);
    if (s > 0.85) { px(sx + 1, sy, WHITE); px(sx, sy + 1, WHITE); }
  }
  // Voyager: gold body, white dish, boom.
  rect(58, bandY + 30, 44, 16, [200, 160, 60]);
  rect(58, bandY + 30, 44, 4, [255, 220, 120]);
  line(102, bandY + 38, 128, bandY + 30, [220, 220, 220]);
  circle(130, bandY + 28, 11, [235, 235, 235]);
  circle(130, bandY + 28, 6, [180, 180, 180]);
  line(58, bandY + 38, 40, bandY + 46, [200, 160, 60]);
  text('VOYAGER 1: ONE LIGHT-DAY FROM HOME', 168, bandY + 12, 3, WHITE);
  text("50 YEARS AFTER LAUNCH, NASA'S PROBE KEEPS GOING", 168, bandY + 40, 2, [200, 200, 210]);

  // Footer ticker: the rest of the day.
  text('ALSO TODAY: VAN GOGH SELLS FOR A RECORD $190.4M', CX, 978, 2, INK, 'center');
  text('JEFFRIES FIRST BLACK SPEAKER • CYCLONE AKVAN • US-IRAN STRIKES', CX, 994, 2, INK, 'center');
}

// ---- Run ----
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
drawPage();
writeFileSync(join(outDir, 'entry.png'), encodePNG());
