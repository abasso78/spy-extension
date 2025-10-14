const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.resolve(__dirname, '..', 'dist');
function error(msg) { console.error(msg); process.exit(1); }

if (!fs.existsSync(distDir)) error('dist directory not found; run build first');

const files = fs.readdirSync(distDir);
const optionsHtml = files.find(f => /^options\..*\.html$/.test(f));
if (!optionsHtml) error('options HTML not found in dist');

const html = fs.readFileSync(path.join(distDir, optionsHtml), 'utf8');

// Find the first inline <script type=importmap>...</script> content
const importmapRegex = new RegExp('<script[^>]*type=importmap[^>]*>([\\s\\S]*?)<\\\/script>', 'i');
const importmapMatch = html.match(importmapRegex);
if (!importmapMatch) {
  console.log('No inline importmap found; nothing to do');
  process.exit(0);
}

const importmapContent = importmapMatch[1].trim();
// Compute hash (for filename and logging)
const hash = crypto.createHash('sha256').update(importmapContent, 'utf8').digest('base64');
const short = hash.replace(/\W/g, '').slice(0, 12);
const importmapFilename = `importmap.${short}.json`;
const importmapPath = path.join(distDir, importmapFilename);

// Write external importmap file
fs.writeFileSync(importmapPath, importmapContent, 'utf8');
console.log('Wrote external importmap to', importmapFilename);

// Replace inline importmap in HTML with external script tag
const newHtml = html.replace(importmapRegex, `<script type=importmap src=/${importmapFilename}></script>`);
const htmlPath = path.join(distDir, optionsHtml);
fs.copyFileSync(htmlPath, htmlPath + '.bak');
fs.writeFileSync(htmlPath, newHtml, 'utf8');
console.log('Replaced inline importmap in', optionsHtml);

// Patch manifest to allow only 'self' (no inline hash needed)
const manifestPath = path.join(distDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) error('dist/manifest.json not found');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.content_security_policy = manifest.content_security_policy || {};
manifest.content_security_policy.extension_pages = `script-src 'self'; object-src 'self'`;
fs.copyFileSync(manifestPath, manifestPath + '.bak2');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log('Patched dist/manifest.json to use script-src \"\'self\'\" only');
