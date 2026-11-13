/**
 * Crisp 1px-outlined bitmap pixel font renderer for classic Tibia overhead names,
 * floating damage/healing popups, and HUD canvas badges (zero subpixel blur).
 */

const GLYPHS = {
  // 5x7 uppercase + symbols + 4x7 / 5x7 lowercase aligned to a 7px cell (rows 0..6, baseline row 5, descender row 6)
  ' ': { w: 2, rows: [0, 0, 0, 0, 0, 0, 0] },
  A: { w: 4, rows: [0b0110, 0b1001, 0b1001, 0b1111, 0b1001, 0b1001, 0] },
  B: { w: 4, rows: [0b1110, 0b1001, 0b1110, 0b1001, 0b1001, 0b1110, 0] },
  C: { w: 4, rows: [0b0111, 0b1000, 0b1000, 0b1000, 0b1000, 0b0111, 0] },
  D: { w: 4, rows: [0b1110, 0b1001, 0b1001, 0b1001, 0b1001, 0b1110, 0] },
  E: { w: 4, rows: [0b1111, 0b1000, 0b1110, 0b1000, 0b1000, 0b1111, 0] },
  F: { w: 4, rows: [0b1111, 0b1000, 0b1110, 0b1000, 0b1000, 0b1000, 0] },
  G: { w: 4, rows: [0b0111, 0b1000, 0b1011, 0b1001, 0b1001, 0b0111, 0] },
  H: { w: 4, rows: [0b1001, 0b1001, 0b1111, 0b1001, 0b1001, 0b1001, 0] },
  I: { w: 3, rows: [0b111, 0b010, 0b010, 0b010, 0b010, 0b111, 0] },
  J: { w: 4, rows: [0b0011, 0b0001, 0b0001, 0b0001, 0b1001, 0b0110, 0] },
  K: { w: 4, rows: [0b1001, 0b1010, 0b1100, 0b1010, 0b1001, 0b1001, 0] },
  L: { w: 4, rows: [0b1000, 0b1000, 0b1000, 0b1000, 0b1000, 0b1111, 0] },
  M: { w: 5, rows: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001, 0b10001, 0] },
  N: { w: 4, rows: [0b1001, 0b1101, 0b1011, 0b1001, 0b1001, 0b1001, 0] },
  O: { w: 4, rows: [0b0110, 0b1001, 0b1001, 0b1001, 0b1001, 0b0110, 0] },
  P: { w: 4, rows: [0b1110, 0b1001, 0b1001, 0b1110, 0b1000, 0b1000, 0] },
  Q: { w: 4, rows: [0b0110, 0b1001, 0b1001, 0b1011, 0b0110, 0b0001, 0] },
  R: { w: 4, rows: [0b1110, 0b1001, 0b1001, 0b1110, 0b1010, 0b1001, 0] },
  S: { w: 4, rows: [0b0111, 0b1000, 0b0110, 0b0001, 0b0001, 0b1110, 0] },
  T: { w: 5, rows: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0] },
  U: { w: 4, rows: [0b1001, 0b1001, 0b1001, 0b1001, 0b1001, 0b0110, 0] },
  V: { w: 5, rows: [0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100, 0] },
  W: { w: 5, rows: [0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001, 0] },
  X: { w: 4, rows: [0b1001, 0b1001, 0b0110, 0b0110, 0b1001, 0b1001, 0] },
  Y: { w: 5, rows: [0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100, 0] },
  Z: { w: 4, rows: [0b1111, 0b0001, 0b0010, 0b0100, 0b1000, 0b1111, 0] },

  a: { w: 4, rows: [0, 0, 0b0110, 0b0001, 0b0111, 0b0111, 0] },
  b: { w: 4, rows: [0b1000, 0b1000, 0b1110, 0b1001, 0b1001, 0b1110, 0] },
  c: { w: 3, rows: [0, 0, 0b011, 0b100, 0b100, 0b011, 0] },
  d: { w: 4, rows: [0b0001, 0b0001, 0b0111, 0b1001, 0b1001, 0b0111, 0] },
  e: { w: 4, rows: [0, 0, 0b0110, 0b1111, 0b1000, 0b0111, 0] },
  f: { w: 3, rows: [0b011, 0b100, 0b111, 0b100, 0b100, 0b100, 0] },
  g: { w: 4, rows: [0, 0, 0b0111, 0b1001, 0b0111, 0b0001, 0b1110] },
  h: { w: 4, rows: [0b1000, 0b1000, 0b1110, 0b1001, 0b1001, 0b1001, 0] },
  i: { w: 1, rows: [0b1, 0, 0b1, 0b1, 0b1, 0b1, 0] },
  j: { w: 3, rows: [0b001, 0, 0b001, 0b001, 0b001, 0b101, 0b010] },
  k: { w: 4, rows: [0b1000, 0b1001, 0b1010, 0b1100, 0b1010, 0b1001, 0] },
  l: { w: 2, rows: [0b10, 0b10, 0b10, 0b10, 0b10, 0b01, 0] },
  m: { w: 5, rows: [0, 0, 0b11010, 0b10101, 0b10101, 0b10001, 0] },
  n: { w: 4, rows: [0, 0, 0b1110, 0b1001, 0b1001, 0b1001, 0] },
  o: { w: 4, rows: [0, 0, 0b0110, 0b1001, 0b1001, 0b0110, 0] },
  p: { w: 4, rows: [0, 0, 0b1110, 0b1001, 0b1110, 0b1000, 0b1000] },
  q: { w: 4, rows: [0, 0, 0b0111, 0b1001, 0b0111, 0b0001, 0b0001] },
  r: { w: 3, rows: [0, 0, 0b101, 0b110, 0b100, 0b100, 0] },
  s: { w: 4, rows: [0, 0, 0b0111, 0b1100, 0b0011, 0b1110, 0] },
  t: { w: 3, rows: [0b010, 0b010, 0b111, 0b010, 0b010, 0b001, 0] },
  u: { w: 4, rows: [0, 0, 0b1001, 0b1001, 0b1001, 0b0111, 0] },
  v: { w: 3, rows: [0, 0, 0b101, 0b101, 0b101, 0b010, 0] },
  w: { w: 5, rows: [0, 0, 0b10001, 0b10101, 0b10101, 0b01010, 0] },
  x: { w: 4, rows: [0, 0, 0b1001, 0b0110, 0b0110, 0b1001, 0] },
  y: { w: 4, rows: [0, 0, 0b1001, 0b1001, 0b0111, 0b0001, 0b1110] },
  z: { w: 4, rows: [0, 0, 0b1111, 0b0010, 0b0100, 0b1111, 0] },

  '0': { w: 4, rows: [0b0110, 0b1001, 0b1011, 0b1101, 0b1001, 0b0110, 0] },
  '1': { w: 3, rows: [0b010, 0b110, 0b010, 0b010, 0b010, 0b111, 0] },
  '2': { w: 4, rows: [0b0110, 0b1001, 0b0010, 0b0100, 0b1000, 0b1111, 0] },
  '3': { w: 4, rows: [0b1110, 0b0001, 0b0110, 0b0001, 0b0001, 0b1110, 0] },
  '4': { w: 4, rows: [0b1001, 0b1001, 0b1111, 0b0001, 0b0001, 0b0001, 0] },
  '5': { w: 4, rows: [0b1111, 0b1000, 0b1110, 0b0001, 0b0001, 0b1110, 0] },
  '6': { w: 4, rows: [0b0110, 0b1000, 0b1110, 0b1001, 0b1001, 0b0110, 0] },
  '7': { w: 4, rows: [0b1111, 0b0001, 0b0010, 0b0100, 0b0100, 0b0100, 0] },
  '8': { w: 4, rows: [0b0110, 0b1001, 0b0110, 0b1001, 0b1001, 0b0110, 0] },
  '9': { w: 4, rows: [0b0110, 0b1001, 0b0111, 0b0001, 0b0001, 0b0110, 0] },

  '+': { w: 3, rows: [0, 0b010, 0b111, 0b010, 0, 0, 0] },
  '-': { w: 3, rows: [0, 0, 0, 0b111, 0, 0, 0] },
  '!': { w: 1, rows: [0b1, 0b1, 0b1, 0b1, 0, 0b1, 0] },
  '?': { w: 4, rows: [0b0110, 0b1001, 0b0010, 0b0100, 0, 0b0100, 0] },
  '.': { w: 1, rows: [0, 0, 0, 0, 0, 0b1, 0] },
  ',': { w: 2, rows: [0, 0, 0, 0, 0, 0b01, 0b10] },
  ':': { w: 1, rows: [0, 0b1, 0, 0, 0b1, 0, 0] },
  "'": { w: 1, rows: [0b1, 0b1, 0, 0, 0, 0, 0] },
  '/': { w: 3, rows: [0b001, 0b001, 0b010, 0b010, 0b100, 0b100, 0] },
  '(': { w: 2, rows: [0b01, 0b10, 0b10, 0b10, 0b10, 0b01, 0] },
  ')': { w: 2, rows: [0b10, 0b01, 0b01, 0b01, 0b01, 0b10, 0] },
};

const LABEL_CACHE = new Map();

function buildLabelCanvas(text, color) {
  const chars = Array.from(String(text));
  let totalW = 0;
  for (let idx = 0; idx < chars.length; idx++) {
    const g = GLYPHS[chars[idx]] || GLYPHS[' '];
    totalW += g.w + (idx < chars.length - 1 ? 1 : 0);
  }
  const width = Math.max(3, totalW + 2);
  const height = 9; // 7px glyph + 1px outline top & bottom

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d');

  // 1px orthogonal + diagonal dark outline pass for classic Tibia legibility
  c.fillStyle = '#000000';
  let cursor = 1;
  for (let idx = 0; idx < chars.length; idx++) {
    const g = GLYPHS[chars[idx]] || GLYPHS[' '];
    for (let ry = 0; ry < 7; ry++) {
      const bits = g.rows[ry];
      if (!bits) continue;
      for (let rx = 0; rx < g.w; rx++) {
        if ((bits >> (g.w - 1 - rx)) & 1) {
          c.fillRect(cursor + rx - 1, ry, 3, 3);
        }
      }
    }
    cursor += g.w + 1;
  }

  // Crisp foreground pixels
  c.fillStyle = color;
  cursor = 1;
  for (let idx = 0; idx < chars.length; idx++) {
    const g = GLYPHS[chars[idx]] || GLYPHS[' '];
    for (let ry = 0; ry < 7; ry++) {
      const bits = g.rows[ry];
      if (!bits) continue;
      for (let rx = 0; rx < g.w; rx++) {
        if ((bits >> (g.w - 1 - rx)) & 1) {
          c.fillRect(cursor + rx, ry + 1, 1, 1);
        }
      }
    }
    cursor += g.w + 1;
  }

  return canvas;
}

/**
 * Draws crisp 1px-outlined bitmap text at integer pixel coordinates.
 * `align`: 'center' | 'left'
 * `baseline`: 'bottom' | 'middle' | 'top'
 */
export function drawPixelText(ctx, text, x, y, color = '#ffffff', align = 'center', baseline = 'bottom') {
  if (!text || typeof document === 'undefined') return;
  const key = `${text}\u0000${color}`;
  let sprite = LABEL_CACHE.get(key);
  if (!sprite) {
    if (LABEL_CACHE.size >= 256) LABEL_CACHE.clear();
    sprite = buildLabelCanvas(text, color);
    LABEL_CACHE.set(key, sprite);
  }

  let dx = Math.round(x);
  if (align === 'center') dx -= Math.floor(sprite.width / 2);

  let dy = Math.round(y);
  if (baseline === 'bottom') dy -= sprite.height;
  else if (baseline === 'middle') dy -= Math.floor(sprite.height / 2);

  ctx.drawImage(sprite, dx, dy);
}
