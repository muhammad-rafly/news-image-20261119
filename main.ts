// THE WORLD TODAY — v2
// A newspaper front page summing up Thursday 19 November 2026,
// drawn entirely in code: pure Node 22 standard library, no assets,
// no network. Writes one deterministic 1024x1024 PNG to
// $MAKEFUN_OUTPUT_DIR/entry.png (default ./out/entry.png).
//
// Layout: masthead + black date band, then the day's news in order of
// consequence — the ICJ genocide verdict (lead), the trilateral summit
// outcome, GTA VI's worldwide midnight rollout and Anthropic's record
// IPO side by side, and an IN BRIEF column for the rest of the day.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- PNG ----

// CRC-32 (IEEE) table, built once.
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE.push(c >>> 0);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Encode a W*H*3 RGB buffer as a PNG (8-bit, colour type 2, no filter).
function encodePNG(rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ canvas -----

type RGB = [number, number, number];
const PAPER: RGB = [246, 241, 227];
const INK: RGB = [25, 23, 19];
const RED: RGB = [158, 27, 27];
const WHITE: RGB = [255, 255, 255];
const SKY: RGB = [43, 50, 69];
const BLDG: RGB = [29, 34, 48];
const WIN: RGB = [242, 193, 78];
const MOON: RGB = [242, 227, 160];
const USRED: RGB = [178, 34, 52];
const USBLE: RGB = [60, 59, 110];
const CNRED: RGB = [222, 41, 16];
const CNYEL: RGB = [255, 222, 0];
const RUBLE: RGB = [0, 57, 166];
const RURED: RGB = [213, 43, 30];
const GRAY: RGB = [120, 112, 96];

const px = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function set(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c);
}

function hline(x: number, y: number, w: number, c: RGB): void {
  rect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: RGB): void {
  rect(x, y, 1, h, c);
}

// Bresenham line.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    set(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Filled triangle (scanline).
function tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB): void {
  const p = [
    [ax, ay],
    [bx, by],
    [cx, cy],
  ].sort((a, b) => a[1] - b[1]);
  const [x0, y0] = p[0];
  const [x1, y1] = p[1];
  const [x2, y2] = p[2];
  if (y2 === y0) return;
  for (let y = y0; y <= y2; y++) {
    let xa: number;
    let xb: number;
    if (y < y1) {
      xa = y0 === y1 ? x0 : x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
      xb = x0 + ((x2 - x0) * (y - y0)) / (y2 - y0);
    } else {
      xa = y1 === y2 ? x1 : x1 + ((x2 - x1) * (y - y1)) / (y2 - y1);
      xb = x0 + ((x2 - x0) * (y - y0)) / (y2 - y0);
    }
    const lo = Math.ceil(Math.min(xa, xb));
    const hi = Math.floor(Math.max(xa, xb));
    for (let x = lo; x <= hi; x++) set(x, y, c);
  }
}

function diamond(cx: number, cy: number, r: number, c: RGB): void {
  tri(cx, cy - r, cx + r, cy, cx, cy + r, c);
  tri(cx, cy - r, cx, cy + r, cx - r, cy, c);
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    const dx = Math.floor(Math.sqrt(r * r - (y - cy) * (y - cy)));
    for (let x = cx - dx; x <= cx + dx; x++) set(x, y, c);
  }
}

// Deterministic pseudo-random (fixed seed) for window lights.
let seed = 20261119;
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// -------------------------------------------------------------- font -----
// 5x7 bitmap font, one row per number, MSB = leftmost column.
// All copy is uppercase ASCII; an unknown character fails loudly so a
// typo never silently drops a letter from the page.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
};

function glyph(ch: string): number[] {
  const g = FONT[ch];
  if (g === undefined) throw new Error("no glyph for character: " + JSON.stringify(ch));
  return g;
}

function textW(text: string, scale: number, spacing = 0): number {
  if (text.length === 0) return 0;
  return text.length * (5 * scale + spacing) - spacing;
}

// x is the anchor: left edge, centre, or right edge depending on align.
function drawText(
  text: string,
  x: number,
  y: number,
  scale: number,
  c: RGB,
  align: "left" | "center" | "right" = "left",
  spacing = 0,
): void {
  const w = textW(text, scale, spacing);
  let ox = x;
  if (align === "center") ox = x - Math.floor(w / 2);
  if (align === "right") ox = x - w;
  for (let i = 0; i < text.length; i++) {
    const g = glyph(text[i]);
    const gx = ox + i * (5 * scale + spacing);
    for (let r = 0; r < 7; r++) {
      const bits = g[r];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) rect(gx + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

// Red letterspaced kicker, left aligned.
function kicker(text: string, x: number, y: number): void {
  drawText(text, x, y, 2, RED, "left", 1);
}

// A block of body lines, scale 3, 26px line height.
function bodyBlock(lines: string[], x: number, y: number): void {
  for (let i = 0; i < lines.length; i++) drawText(lines[i], x, y + i * 26, 3, INK);
}

// ------------------------------------------------------------- layout ----

// Masthead.
drawText("THE WORLD TODAY", 512, 12, 10, INK, "center", 1);
// Black date band.
rect(36, 90, 952, 36, INK);
drawText("THURSDAY 19 NOVEMBER 2026", 512, 94, 4, WHITE, "center");
// Double rule under the masthead.
rect(36, 134, 952, 3, INK);
rect(36, 139, 952, 1, INK);

// --- Lead story: the ICJ verdict. --------------------------------------
kicker("THE HAGUE - INTERNATIONAL COURT OF JUSTICE", 36, 150);
// Scales of justice, right of the kicker.
disc(920, 152, 4, INK);
rect(918, 156, 4, 48, INK);
rect(886, 158, 68, 4, INK);
tri(890, 162, 880, 192, 900, 192, INK);
tri(950, 162, 940, 192, 960, 192, INK);
rect(904, 204, 32, 4, INK);
drawText("MYANMAR GUILTY OF", 36, 172, 7, INK);
drawText("ROHINGYA GENOCIDE", 36, 227, 7, INK);
bodyBlock(
  [
    "THE COURT RULES 9-6 THAT MYANMAR COMMITTED",
    "GENOCIDE, THE FIRST TIME THE ICJ HAS HELD",
    "A STATE RESPONSIBLE. ABOUT 10,000 KILLED;",
    "REPARATIONS ORDERED AND SAFE RETURN.",
  ],
  36,
  286,
);
rect(36, 398, 952, 2, INK);

// --- Second story: the trilateral summit outcome. -----------------------
kicker("SHENZHEN - THE TRILATERAL SUMMIT", 36, 410);
drawText("TRUMP, XI AND PUTIN:", 36, 432, 5, INK);
drawText("'A NUCLEAR WAR CANNOT BE WON'", 36, 473, 5, INK);
bodyBlock(
  [
    "NINETY MINUTES AT KYLIN VILLA END WITH A JOINT",
    "STATEMENT ON NUCLEAR RISKS, UN REFORM AND",
    "REFINED PETROLEUM. TRUMP, PUTIN TALK 40 MIN;",
    "TRUMP TO MEET KIM JONG-UN 'AT SOME POINT'.",
  ],
  36,
  518,
);
// Thin 1px border around a flag (outline only — never filled).
function flagFrame(x: number, y: number, w: number, h: number): void {
  hline(x - 1, y - 1, w + 2, INK);
  hline(x - 1, y + h, w + 2, INK);
  vline(x - 1, y - 1, h + 2, INK);
  vline(x + w, y - 1, h + 2, INK);
}
// The three flags, centred as a row.
// United States: 13 stripes, blue canton, white stars.
rect(338, 628, 100, 66, WHITE);
for (let i = 0; i < 13; i += 2) rect(338, 628 + i * 5, 100, 5, USRED);
rect(338, 628, 40, 35, USBLE);
for (let r = 0; r < 4; r++)
  for (let c = 0; c < 5; c++) rect(342 + c * 8, 633 + r * 7, 2, 2, WHITE);
flagFrame(338, 628, 100, 66);
// China: red field, one large star, four small.
rect(462, 628, 100, 66, CNRED);
diamond(478, 644, 9, CNYEL);
diamond(496, 634, 4, CNYEL);
diamond(504, 642, 4, CNYEL);
diamond(504, 654, 4, CNYEL);
diamond(496, 662, 4, CNYEL);
flagFrame(462, 628, 100, 66);
// Russia: white, blue, red bands.
rect(586, 628, 100, 22, WHITE);
rect(586, 650, 100, 22, RUBLE);
rect(586, 672, 100, 22, RURED);
flagFrame(586, 628, 100, 66);
rect(36, 706, 952, 2, INK);

// --- Third row: two columns. --------------------------------------------
vline(512, 718, 188, GRAY);
// Left: GTA VI.
kicker("VICE CITY - VIDEO GAMES", 36, 718);
drawText("GTA VI IS HERE", 36, 740, 5, INK);
const gtaBody = [
  "THE LONG-AWAITED SEQUEL ROLLS OUT AT",
  "LOCAL MIDNIGHT AROUND THE WORLD,",
  "NEW ZEALAND FIRST, ON PS5 AND XBOX.",
  "NO PC VERSION AT LAUNCH.",
];
for (let i = 0; i < gtaBody.length; i++) drawText(gtaBody[i], 36, 784 + i * 18, 2, INK);
// Vice City skyline at dusk.
rect(36, 860, 464, 46, SKY);
disc(468, 874, 9, MOON);
const towers: [number, number, number][] = [
  [44, 44, 878],
  [92, 36, 868],
  [132, 52, 884],
  [188, 40, 872],
  [232, 48, 880],
  [284, 36, 866],
  [324, 52, 876],
  [380, 40, 870],
  [424, 44, 882],
  [472, 24, 874],
];
for (const [tx, tw, top] of towers) {
  rect(tx, top, tw, 906 - top, BLDG);
  for (let w = 0; w < 6; w++) {
    const wx = tx + 4 + Math.floor(rnd() * Math.max(1, tw - 8));
    const wy = top + 5 + Math.floor(rnd() * Math.max(1, 906 - top - 10));
    rect(wx, wy, 3, 3, WIN);
  }
}
vline(302, 858, 8, INK);
disc(302, 857, 2, RED);
// Right: Anthropic's IPO.
kicker("MARKETS - TECHNOLOGY", 524, 718);
drawText("ANTHROPIC'S", 524, 740, 5, INK);
drawText("$81.3BN DEBUT", 524, 781, 5, INK);
const aiBody = [
  "THE AI LAB'S MARKET DEBUT VALUES IT AT",
  "$81.3 BILLION IN ONE OF THE YEAR'S",
  "BIGGEST LISTINGS.",
];
for (let i = 0; i < aiBody.length; i++) drawText(aiBody[i], 524, 824 + i * 18, 2, INK);
// Rising bars.
hline(580, 904, 220, INK);
const bars: [number, number][] = [
  [620, 16],
  [680, 24],
  [740, 32],
];
for (const [bx, bh] of bars) rect(bx, 904 - bh, 28, bh, INK);
rect(740, 904 - 32, 28, 32, RED);
line(600, 892, 788, 868, RED);
tri(792, 866, 776, 864, 780, 878, RED);
rect(36, 918, 952, 2, INK);

// --- IN BRIEF: the rest of the day. --------------------------------------
rect(36, 930, 10, 10, RED);
drawText("IN BRIEF", 54, 928, 3, INK);
const briefLeft = [
  "IAEA: N. KOREA EXPANDS YONGBYON",
  "GAZA: TROOPS CROSS CEASEFIRE LINE",
  "VOYAGER 1 REACHES ONE LIGHT-DAY",
];
const briefRight = [
  "VAN GOGH SELLS FOR RECORD $190.4M",
  "CRIMEAN BRIDGE HIT AGAIN",
  "IEA: IRAN WAR HIT OIL TRADE HARDEST",
];
for (let i = 0; i < 3; i++) {
  const y = 958 + i * 18;
  rect(36, y + 2, 8, 8, RED);
  drawText(briefLeft[i], 56, y, 2, INK);
  rect(524, y + 2, 8, 8, RED);
  drawText(briefRight[i], 544, y, 2, INK);
}
rect(36, 1016, 952, 1, INK);

// ------------------------------------------------------------------ out --
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
mkdirSync(outDir, { recursive: true });
const png = encodePNG(px);
writeFileSync(join(outDir, "entry.png"), png);
console.log(`entry.png: ${png.length} bytes, ${W}x${H}`);
