import fs from 'fs';
import path from 'path';
import os from 'os';
import { externalizeImportmaps } from '../../../src/utils/importmap-externalizer';

describe('externalizeImportmaps', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
  });

  afterEach(() => {
    // remove tmpDir recursively
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('exports inline importmap and patches html and manifest', () => {
    const html = `<!doctype html><html><head><script type="importmap">{"imports":{"a":"./a.js"}}</script></head><body></body></html>`;
    const htmlPath = path.join(tmpDir, 'options.test.html');
    fs.writeFileSync(htmlPath, html, 'utf8');

    const manifest = { manifest_version: 3 };
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');

    const result = externalizeImportmaps(tmpDir);
    expect(result.written.length).toBeGreaterThan(0);

    // importmaps folder should exist
    const importmapsDir = path.join(tmpDir, 'importmaps');
    expect(fs.existsSync(importmapsDir)).toBe(true);

    // HTML should be updated to reference the importmap file
    const updated = fs.readFileSync(htmlPath, 'utf8');
    expect(updated).toMatch(/<script type=\"importmap\" src=\"\.\/importmaps\/importmap\.[a-zA-Z0-9]+\.json\"><\/script>/);

    // manifest should be patched
    const patched = JSON.parse(fs.readFileSync(path.join(tmpDir, 'manifest.json'), 'utf8'));
    expect(patched.content_security_policy).toBeDefined();
    expect(patched.content_security_policy.extension_pages).toContain("'self'");
  });
});
