const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = process.argv[2] || path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.error('dist directory not found; run build first');
  process.exit(1);
}

const importmapRegex = /<script[^>]*type\s*=\s*(?:("|')?)importmap\1?[^>]*>([\s\S]*?)<\/script>/i;
const outDir = path.join(distDir, 'importmaps');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const files = fs.readdirSync(distDir).filter(f => /\.html?$/.test(f));
const written = [];
for (const file of files) {
  const filePath = path.join(distDir, file);
  const html = fs.readFileSync(filePath, 'utf8');
  const match = html.match(importmapRegex);
  if (!match) continue;
  const importmapContent = match[2].trim();
  if (!importmapContent) continue;
  const hash = crypto.createHash('sha256').update(importmapContent, 'utf8').digest('base64');
  const short = hash.replace(/\W/g, '').slice(0, 12);
  const importmapFilename = `importmap.${short}.json`;
  const importmapPath = path.join(outDir, importmapFilename);
  fs.writeFileSync(importmapPath, importmapContent, 'utf8');
  written.push(path.relative(distDir, importmapPath));
  const replaced = html.replace(importmapRegex, `<script type="importmap" src="./importmaps/${importmapFilename}"></script>`);
  fs.copyFileSync(filePath, filePath + '.bak');
  fs.writeFileSync(filePath, replaced, 'utf8');
  console.log('Wrote external importmap to', importmapFilename, 'for', file);
}

const manifestPath = path.join(distDir, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.content_security_policy = manifest.content_security_policy || {};
  manifest.content_security_policy.extension_pages = `script-src 'self'; object-src 'self'`;
  manifest.web_accessible_resources = manifest.web_accessible_resources || [];
  const hasWildcard = manifest.web_accessible_resources.some(e => Array.isArray(e.resources) && e.resources.includes('*'));
  if (hasWildcard) {
    manifest.web_accessible_resources = manifest.web_accessible_resources.filter(e => !(Array.isArray(e.resources) && e.resources.includes('*')));
  }
  const importmapEntryExists = manifest.web_accessible_resources.some(e => Array.isArray(e.resources) && e.resources.includes('importmaps/*'));
  if (!importmapEntryExists) {
    manifest.web_accessible_resources.push({ resources: ['importmaps/*'], matches: ['<all_urls>'] });
  }
  fs.copyFileSync(manifestPath, manifestPath + '.bak2');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Patched dist/manifest.json to use script-src "\'self\'" only and added importmaps/*');
}

if (written.length === 0) console.log('No inline importmap found; nothing to do');
else console.log('Wrote external importmaps:', written.join(', '));
