import sharp from 'sharp';
import { mkdir } from 'fs/promises';

await mkdir('public/icons', { recursive: true });

const svg = (size) => Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="28" fill="#7c6af7"/>

  <path d="M20 24h24" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <path d="M32 18v28" stroke="white" stroke-width="4" stroke-linecap="round"/>

  <path d="M16 24l-6 10h12z" fill="white"/>
  <path d="M48 24l-6 10h12z" fill="white"/>
</svg>`);

try {
  await sharp(svg(192)).png().toFile('public/icons/icon-192.png');
  await sharp(svg(512)).png().toFile('public/icons/icon-512.png');
} catch (error) {
  console.error('Errorea ikonoa sortzeko:', error);
}