import fs from "node:fs/promises";
// A small original F mark, stored as a Windows ICO without another build dependency.
const size = 64,
  maskBytes = 8 * size,
  pixels = size * size * 4,
  dib = Buffer.alloc(40 + pixels + maskBytes);
dib.writeUInt32LE(40, 0);
dib.writeInt32LE(size, 4);
dib.writeInt32LE(size * 2, 8);
dib.writeUInt16LE(1, 12);
dib.writeUInt16LE(32, 14);
dib.writeUInt32LE(pixels + maskBytes, 20);
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const at = 40 + ((size - 1 - y) * size + x) * 4;
    const mark =
      (x >= 17 && x <= 25 && y >= 15 && y <= 49) ||
      (x >= 17 && x <= 48 && y >= 15 && y <= 23) ||
      (x >= 17 && x <= 42 && y >= 30 && y <= 37);
    const round =
      (x < 7 && y < 7) ||
      (x > 56 && y < 7) ||
      (x < 7 && y > 56) ||
      (x > 56 && y > 56);
    dib[at] = mark ? 249 : 88;
    dib[at + 1] = mark ? 224 : 57;
    dib[at + 2] = mark ? 211 : 43;
    dib[at + 3] = round ? 0 : 255;
  }
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = size;
header[7] = size;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(dib.length, 14);
header.writeUInt32LE(22, 18);
await fs.writeFile("resources/icon.ico", Buffer.concat([header, dib]));
