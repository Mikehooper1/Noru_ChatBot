const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendPublic = path.join(__dirname, '../public');
const widgetDist = path.join(__dirname, '../../widget/dist/widget.min.js');
const widgetRoot = path.join(__dirname, '../../widget');
const target = path.join(backendPublic, 'widget.min.js');

if (!fs.existsSync(backendPublic)) {
  fs.mkdirSync(backendPublic, { recursive: true });
}

if (fs.existsSync(widgetDist)) {
  fs.copyFileSync(widgetDist, target);
  console.log('Copied widget/dist/widget.min.js → backend/public/widget.min.js');
  process.exit(0);
}

if (fs.existsSync(path.join(widgetRoot, 'package.json'))) {
  try {
    console.log('Building widget from ../widget ...');
    execSync('npm run build', { cwd: widgetRoot, stdio: 'inherit' });
    if (fs.existsSync(widgetDist)) {
      fs.copyFileSync(widgetDist, target);
      console.log('Built and copied widget → backend/public/widget.min.js');
      process.exit(0);
    }
  } catch (err) {
    console.warn('Widget build failed:', err.message);
  }
}

if (fs.existsSync(target)) {
  console.log('Using existing backend/public/widget.min.js');
  process.exit(0);
}

console.error(
  'Widget file missing. Run from repo root:\n  cd widget && npm install && npm run build\n  cd ../backend && node scripts/copy-widget.js'
);
process.exit(1);
