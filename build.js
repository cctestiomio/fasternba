import { mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

mkdirSync('dist', { recursive: true });
for (const file of ['index.html', 'src/app.js', 'src/styles.css']) {
  const out = file.startsWith('src/') ? join('dist', file.replace('src/', '')) : join('dist', file);
  copyFileSync(file, out);
}
console.log('Built static dashboard to dist/');
