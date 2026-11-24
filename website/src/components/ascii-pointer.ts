const cellWidth = 9;
const cellHeight = 13;
const tileColumns = 112;
const tileRows = 48;
const ramp = '.:-~=+*o%#';
const code = '01{}[]<>/+=*#$%&@?!';
export const fieldSize = 216;
const half = fieldSize / 2;

const rowOffset = Math.floor(cellHeight / 2);
const columnOffset = Math.floor(cellWidth / 2);

function ribbonAt(col: number, row: number) {
  const x = (col / tileColumns) * Math.PI * 2;
  const y = (row / tileRows) * Math.PI * 2;
  const fold = Math.sin(x) * 0.92 + Math.sin(x * 2 + 0.8) * 0.28;
  const back = Math.abs(Math.sin(y - fold + 0.42 * Math.cos(x + y)));
  const front = Math.abs(Math.sin(y + fold * 0.82 + 0.72));
  return Math.min(front, back + 0.12);
}

const hash = (col: number, row: number) =>
  (Math.imul(col, 73856093) ^ Math.imul(row, 19349663)) >>> 0;

export function makeAsciiRibbon(ink: string, accent: string) {
  const canvas = document.createElement('canvas');
  canvas.width = tileColumns * cellWidth;
  canvas.height = tileRows * cellHeight;
  const pen = canvas.getContext('2d');
  if (!pen) return 'none';
  pen.font = '500 10px monospace';
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';

  for (let row = 0; row < tileRows; row++) {
    for (let col = 0; col < tileColumns; col++) {
      const distance = ribbonAt(col, row);
      if (distance > 0.47) continue;
      const contour = (0.5 + 0.5 * Math.cos(distance * 31)) ** 6;
      const density = (1 - distance / 0.47) * (0.33 + contour * 0.67);
      const edgeWeight =
        0.48 + 0.52 * Math.cos((Math.PI * col) / tileColumns) ** 2;
      pen.globalAlpha = 0.22 * density * edgeWeight;
      pen.fillStyle = contour > 0.62 ? accent : ink;
      pen.fillText(
        ramp[Math.floor(density * (ramp.length - 1))],
        col * cellWidth + columnOffset,
        row * cellHeight + rowOffset,
      );
    }
  }

  return `url("${canvas.toDataURL()}")`;
}

export function paintAsciiWake(
  pen: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
) {
  pen.clearRect(0, 0, fieldSize, fieldSize);
  pen.font = '600 11px monospace';
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';

  const gridX = Math.floor((x - half) / cellWidth);
  const gridY = Math.floor((y - half) / cellHeight);
  const offsetX = gridX * cellWidth - x + half + columnOffset;
  const offsetY = gridY * cellHeight - y + half + rowOffset;
  const fade = Math.min(1, progress * 14) * (1 - progress) ** 1.75;
  const phase = Math.floor(progress * 6);

  for (let row = 0; row <= fieldSize / cellHeight; row++) {
    for (let col = 0; col <= fieldSize / cellWidth; col++) {
      const px = offsetX + col * cellWidth;
      const py = offsetY + row * cellHeight;
      const dx = px - half;
      const dy = py - half;
      const distance = Math.hypot(dx, dy * 1.2);
      const ribbon = ribbonAt(gridX + col, gridY + row);
      const warmth =
        Math.max(0, 1 - distance / 99) *
        (0.32 + 0.68 * Math.max(0, 1 - ribbon * 1.8));
      if (warmth < 0.06) continue;

      const seed = hash(gridX + col, gridY + row);
      const shift = warmth * (1 - progress) * 0.05;
      pen.globalAlpha = warmth * fade * (0.48 + (seed % 5) * 0.07);
      pen.fillText(
        code[(seed + phase) % code.length],
        px + dx * shift,
        py + dy * shift,
      );
    }
  }
  pen.globalAlpha = 1;
}
