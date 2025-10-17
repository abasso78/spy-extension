import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function externalizeImportmaps(distDir: string): { written: string[] } {
  if (!fs.existsSync(distDir)) throw new Error('dist directory not found; run build first');

  const files = fs.readdirSync(distDir).filter(f => /\.html?$/.test(f));
  if (!files.length) return { written: [] };

  // Accept type=importmap or type="importmap" (quoted) or type='importmap'
  const importmapRegex = /<script[^>]*type\s*=\s*(?:"|')?importmap(?:"|')?[^>]*>([\s\S]*?)<\/script>/i;
  const outDir = path.join(distDir, 'importmaps');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const written: string[] = [];
  for (const file of files) {
    const filePath = path.join(distDir, file);
    const html = fs.readFileSync(filePath, 'utf8');
    const match = html.match(importmapRegex);
    if (!match) continue;

    const importmapContent = match[1].trim();
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
  }

  // Patch manifest if present
  const manifestPath = path.join(distDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.content_security_policy = manifest.content_security_policy || {};
    manifest.content_security_policy.extension_pages = `script-src 'self'; object-src 'self'`;
    // Ensure web_accessible_resources contains an explicit importmaps entry
    manifest.web_accessible_resources = manifest.web_accessible_resources || [];
    // If there's already a wildcard resource entry, replace it with a tighter one
    const hasWildcard = manifest.web_accessible_resources.some((e: any) => Array.isArray(e.resources) && e.resources.includes('*'));
    if (hasWildcard) {
      manifest.web_accessible_resources = manifest.web_accessible_resources.filter((e: any) => !(Array.isArray(e.resources) && e.resources.includes('*')));
    }
    // Ensure importmaps/* entry exists with matches ["<all_urls>"]
    const importmapEntryExists = manifest.web_accessible_resources.some((e: any) => Array.isArray(e.resources) && e.resources.includes('importmaps/*'));
    if (!importmapEntryExists) {
      manifest.web_accessible_resources.push({ resources: ['importmaps/*'], matches: ['<all_urls>'] });
    }

    fs.copyFileSync(manifestPath, manifestPath + '.bak2');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  return { written };
}
