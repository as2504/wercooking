// Generates PNG icons from public/favicon.svg. Run: npm run icons
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg');
// Maskable: full-bleed background, artwork inside the 80% safe zone.
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#C2410C"/>
   <image href="data:image/svg+xml;base64,${svg.toString('base64')}" x="76" y="76" width="360" height="360"/></svg>`,
);
const square = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#C2410C"/>
   <image href="data:image/svg+xml;base64,${svg.toString('base64')}" x="0" y="0" width="512" height="512"/></svg>`,
);
await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png');
await sharp(maskable).resize(512, 512).png().toFile('public/pwa-maskable-512.png');
await sharp(square).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('icons generated');
