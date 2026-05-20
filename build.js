const fs = require('fs');
const path = require('path');
const root = __dirname;
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const file of ['index.html']) fs.copyFileSync(path.join(root, file), path.join(dist, file));
for (const file of ['app.js', 'styles.css']) fs.copyFileSync(path.join(root, 'src', file), path.join(dist, file));
console.log('Built static dashboard to dist/');
