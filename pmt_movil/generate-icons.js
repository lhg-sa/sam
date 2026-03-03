import fs from 'fs';
import { createCanvas } from 'canvas';

function createIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(0, 0, size, size);

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PMT', size / 2, size / 2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`Created ${filename}`);
}

createIcon(192, 'public/pwa-192x192.png');
createIcon(512, 'public/pwa-512x512.png');
