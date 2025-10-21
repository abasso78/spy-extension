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

// Find all .html files recursively under distDir
function findHtmlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHtmlFiles(full));
    } else if (/\.html?$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const htmlFiles = findHtmlFiles(distDir);
const written = [];
for (const filePath of htmlFiles) {
  const relFile = path.relative(distDir, filePath);
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
  console.log('Wrote external importmap to', importmapFilename, 'for', relFile);
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

// Create a stable redirect for the original options page so runtime code can
// navigate to a predictable path (options/index.html) even though parcel
// fingerprints the actual filename.
try {
  const filesAll = fs.readdirSync(distDir);
  const optionsHtml = filesAll.find(f => /^options\.[\w]+\.html$/.test(f));
  if (optionsHtml) {
    const optionsDir = path.join(distDir, 'options');
    if (!fs.existsSync(optionsDir)) fs.mkdirSync(optionsDir);
    const redirectPath = path.join(optionsDir, 'index.html');
    const rel = `./${optionsHtml}`;
    // Use a meta-refresh redirect and a clickable link as a noscript/JS-free
    // fallback so we don't inject inline scripts that violate CSP.
    const redirectHtml = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting...</title>
<meta http-equiv="refresh" content="0;url=${rel}">
<body>
  If you are not redirected automatically, <a href="${rel}">click here</a>.
</body>`;
    fs.writeFileSync(redirectPath, redirectHtml, 'utf8');
    console.log('Wrote stable options redirect to', path.relative(distDir, redirectPath));
  } else {
    console.log('No built options HTML found to create redirect');
  }
} catch (e) {
  console.error('Failed to write options redirect', e);
}

// Cleanup: remove any backup files created during processing so stale backups
// (like *.html.bak) don't end up being loaded by the browser and trigger
// CSP violations. This removes files ending with .bak or .bak2 anywhere under
// dist.
function removeBackupFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeBackupFiles(full);
    } else if (/\.bak(?:2|3)?$/.test(entry.name)) {
      try {
        fs.unlinkSync(full);
        console.log('Removed backup file', path.relative(distDir, full));
      } catch (err) {
        console.warn('Could not remove backup file', full, err && err.message);
      }
    }
  }
}

try {
  removeBackupFiles(distDir);
} catch (err) {
  console.warn('Cleanup of backup files failed:', err && err.message);
}

// Normalize asset paths: rewrite leading-/ absolute asset refs to relative
// Build a mapping of basename -> [relative paths] for quick lookup
function findAllFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function normalizeAssetPaths(dir) {
  const allFiles = findAllFiles(dir).map(f => path.relative(dir, f));
  const byBase = {};
  for (const rel of allFiles) {
    const base = path.posix.basename(rel);
    (byBase[base] || (byBase[base] = [])).push(rel.split(path.sep).join('/'));
  }

  const htmlFiles = findHtmlFiles(dir);
  for (const filePath of htmlFiles) {
    const relHtml = path.relative(dir, filePath).split(path.sep).join('/');
    const htmlDir = path.posix.dirname(relHtml);
    let html = fs.readFileSync(filePath, 'utf8');

    // helper to resolve a candidate value to a correct relative path if possible
    const resolveToRel = (val) => {
      if (!val) return val;
      // ignore absolute URLs and data: URLs
      if (/^[a-zA-Z]+:/.test(val) || val.startsWith('//') || val.startsWith('data:')) return val;
      // strip any leading './' for lookup
      const cleaned = val.replace(/^\.\//, '');
      const base = path.posix.basename(cleaned);
      const candidates = byBase[base];
      if (!candidates || candidates.length === 0) return val;
      // prefer candidate in same directory as html if present
      let chosen = candidates.find(c => path.posix.dirname(c) === htmlDir);
      if (!chosen) {
        // prefer candidate at repo root (no slash)
        chosen = candidates.find(c => !c.includes('/')) || candidates[0];
      }
      // compute relative path from htmlDir to chosen
      const from = htmlDir === '.' ? '' : htmlDir;
      let relPath = path.posix.relative(from || '.', chosen);
      if (!relPath) relPath = path.posix.basename(chosen);
      // ensure no Windows backslashes
      relPath = relPath.split(path.sep).join('/');
      return relPath;
    };

    // rewrite src and href attributes
    html = html.replace(/(src|href)=(["']?)([^"'\s>]+)\2/gi, (m, attr, q, val) => {
      const newVal = resolveToRel(val);
      // preserve original quoting if present
      const quote = q || '"';
      return `${attr}=${quote}${newVal}${quote}`;
    });

    // rewrite importmap src specifically (in case of slightly different attr formatting)
    html = html.replace(/(<script[^>]*type\s*=\s*(["']?)importmap\2[^>]*src=)(["']?)([^"'\s>]+)(["']?)/gi,
      (m, pre, _q1, q2, val, q3) => {
        const newVal = resolveToRel(val);
        const quote = q2 || q3 || '"';
        return `${pre}${quote}${newVal}${quote}`;
      });

    // write a temporary backup and save
    fs.copyFileSync(filePath, filePath + '.bak3');
    fs.writeFileSync(filePath, html, 'utf8');
  }
}

try {
  normalizeAssetPaths(distDir);
  console.log('Normalized asset paths in HTML to remove leading slashes');
} catch (err) {
  console.warn('Normalization of asset paths failed:', err && err.message);
}

// Cleanup any backup files created during normalization
try {
  removeBackupFiles(distDir);
} catch (err) {
  console.warn('Cleanup of backup files after normalization failed:', err && err.message);
}
