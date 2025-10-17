#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const distDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const outFile = path.resolve(process.argv[3] || path.join(__dirname, '..', 'extension.zip'));

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found:', distDir);
  process.exit(1);
}

const output = fs.createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Wrote ${outFile} (${archive.pointer()} total bytes)`);
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') console.warn(err.message);
  else throw err;
});

archive.on('error', (err) => { throw err; });

archive.pipe(output);
archive.directory(distDir + '/', false);
archive.finalize();
