// Ejecuta este script UNA VEZ con: node generate-icons.mjs
// Requiere: npm install -D sharp
// Genera los iconos PNG a partir del color de marca
import sharp from 'sharp';
import { mkdir } from 'fs/promises';

await mkdir('public/icons', { recursive: true });

const svg = (size) => Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#7c6af7"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="sans-serif" font-weight="700" font-size="${size * 0.48}" fill="white">k</text>
</svg>`);

await sharp(svg(192)).png().toFile('public/icons/icon-192.png');
await sharp(svg(512)).png().toFile('public/icons/icon-512.png');
console.log('✅ Iconos generados en public/icons/');
