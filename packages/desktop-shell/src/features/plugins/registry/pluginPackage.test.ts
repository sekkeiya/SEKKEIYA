import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { extractPluginPackage, packPluginFiles, packageFileName } from './pluginPackage';

const MANIFEST = {
  id: 'com.example.my-tool',
  name: 'My Tool',
  version: '0.1.0',
  engine: '^1.0.0',
  entry: 'index.html',
  contributes: { tab: { label: 'My Tool' } },
};

function makeZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [p, c] of Object.entries(files)) entries[p] = strToU8(c);
  return zipSync(entries);
}

describe('extractPluginPackage — 正常系', () => {
  it('ルート直下に plugin.json がある zip を展開できる', () => {
    const zip = makeZip({
      'plugin.json': JSON.stringify(MANIFEST),
      'index.html': '<!doctype html><p>hi</p>',
      'assets/app.js': 'console.log(1)',
    });
    const r = extractPluginPackage(zip);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pkg.manifest.id).toBe('com.example.my-tool');
    expect(Object.keys(r.pkg.files).sort()).toEqual(['assets/app.js', 'index.html', 'plugin.json']);
  });

  it('単一トップフォルダ形式（フォルダごと zip）も剥がして受け付ける', () => {
    const zip = makeZip({
      'my-tool/plugin.json': JSON.stringify(MANIFEST),
      'my-tool/index.html': '<p>hi</p>',
    });
    const r = extractPluginPackage(zip);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.pkg.files).sort()).toEqual(['index.html', 'plugin.json']);
  });

  it('packPluginFiles → extractPluginPackage で往復できる', () => {
    const bytes = packPluginFiles({
      'plugin.json': strToU8(JSON.stringify(MANIFEST)),
      'index.html': strToU8('<p>ok</p>'),
    });
    const r = extractPluginPackage(bytes);
    expect(r.ok).toBe(true);
  });
});

describe('extractPluginPackage — 異常系', () => {
  it('zip でないバイト列を拒否する', () => {
    const r = extractPluginPackage(strToU8('not a zip'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('zip');
  });

  it('plugin.json が無いと拒否する', () => {
    const r = extractPluginPackage(makeZip({ 'index.html': '<p></p>' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('plugin.json');
  });

  it('manifest の検証エラーを伝える', () => {
    const r = extractPluginPackage(makeZip({
      'plugin.json': JSON.stringify({ ...MANIFEST, id: 'BAD ID' }),
      'index.html': '<p></p>',
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('id');
  });

  it('engine 非互換を拒否する（本体 API 1.0.0 に対して ^2.0.0）', () => {
    const r = extractPluginPackage(makeZip({
      'plugin.json': JSON.stringify({ ...MANIFEST, engine: '^2.0.0' }),
      'index.html': '<p></p>',
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('^2.0.0');
  });

  it('entry のファイルが無いと拒否する', () => {
    const r = extractPluginPackage(makeZip({ 'plugin.json': JSON.stringify(MANIFEST) }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('index.html');
  });

  it('パストラバーサル（..）を含む zip を拒否する', () => {
    const r = extractPluginPackage(makeZip({
      'plugin.json': JSON.stringify(MANIFEST),
      'index.html': '<p></p>',
      '../evil.txt': 'x',
    }));
    expect(r.ok).toBe(false);
  });
});

describe('packageFileName', () => {
  it('id-version.zip を返す', () => {
    expect(packageFileName(MANIFEST)).toBe('com.example.my-tool-0.1.0.zip');
  });
});
