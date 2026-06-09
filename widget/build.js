const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const buildOptions = {
  entryPoints: [path.join(__dirname, 'src', 'widget.js')],
  outfile: path.join(distDir, 'widget.min.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2018'],
};

if (watch) {
  esbuild.context(buildOptions).then((ctx) => {
    ctx.watch();
    console.log('Watching widget...');
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log('Built widget/dist/widget.min.js');
  }).catch(() => process.exit(1));
}
