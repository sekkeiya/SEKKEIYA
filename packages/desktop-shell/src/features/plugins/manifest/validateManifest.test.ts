import { describe, it, expect } from 'vitest';
import { validateManifest } from './validateManifest';

const valid = {
  id: 'com.example.estimate',
  name: '見積もり',
  version: '0.1.0',
  engine: '^1.0.0',
  entry: 'index.html',
  contributes: { tab: { label: '見積もり' } },
  permissions: { workFiles: 'readwrite', network: ['https://api.example.com'] },
};

const errorsFor = (raw: unknown): string[] => {
  const r = validateManifest(raw);
  return r.ok ? [] : r.errors.map(e => `${e.path}: ${e.message}`);
};

describe('validateManifest — 正常系', () => {
  it('妥当な manifest を通す', () => {
    const r = validateManifest(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifest.id).toBe('com.example.estimate');
  });
  it('省略可能なキーが無くても通る', () => {
    expect(validateManifest({ id: 'a.b', name: 'x', version: '1.0.0', engine: '^1.0.0', entry: 'i.html' }).ok).toBe(true);
  });
});

describe('validateManifest — 必須キー', () => {
  it('オブジェクトでないものを弾く', () => {
    expect(errorsFor(null).join()).toContain('オブジェクト');
    expect(errorsFor([]).join()).toContain('オブジェクト');
    expect(errorsFor('x').join()).toContain('オブジェクト');
  });
  it('必須キーの欠落をすべて挙げる', () => {
    const errs = errorsFor({});
    for (const k of ['id', 'name', 'version', 'engine', 'entry']) {
      expect(errs.join()).toContain(k);
    }
  });
});

describe('validateManifest — id', () => {
  it('逆ドメイン形式でないものを弾く', () => {
    expect(errorsFor({ ...valid, id: 'estimate' }).join()).toContain('id');
    expect(errorsFor({ ...valid, id: 'Com.Example' }).join()).toContain('id');
    expect(errorsFor({ ...valid, id: 'com..example' }).join()).toContain('id');
  });
  it('ハイフンと数字は使える', () => {
    expect(validateManifest({ ...valid, id: 'com.example-2.my-tool' }).ok).toBe(true);
  });
});

describe('validateManifest — version / engine', () => {
  it('semver でない version を弾く', () => {
    expect(errorsFor({ ...valid, version: '1.0' }).join()).toContain('version');
  });
  it('対応していない range 形式を弾く', () => {
    expect(errorsFor({ ...valid, engine: '>=1.0.0' }).join()).toContain('engine');
    expect(errorsFor({ ...valid, engine: '*' }).join()).toContain('engine');
  });
  it('^x.y.z と x.y.z は通る', () => {
    expect(validateManifest({ ...valid, engine: '1.2.3' }).ok).toBe(true);
    expect(validateManifest({ ...valid, engine: '^1.2.3' }).ok).toBe(true);
  });
  it('engine にプレリリースを書くと弾く', () => {
    expect(errorsFor({ ...valid, engine: '^1.0.0-beta.1' }).join()).toContain('engine');
  });
  it('version のプレリリースは照合に使わないので通る', () => {
    expect(validateManifest({ ...valid, version: '1.0.0-beta.1' }).ok).toBe(true);
  });
});

describe('validateManifest — entry のパス脱出', () => {
  it('.. を含むパスを弾く', () => {
    expect(errorsFor({ ...valid, entry: '../secret.html' }).join()).toContain('entry');
    expect(errorsFor({ ...valid, entry: 'a/../../b.html' }).join()).toContain('entry');
  });
  it('絶対パスとドライブレターを弾く', () => {
    expect(errorsFor({ ...valid, entry: '/index.html' }).join()).toContain('entry');
    expect(errorsFor({ ...valid, entry: 'C:/index.html' }).join()).toContain('entry');
    expect(errorsFor({ ...valid, entry: '\\\\index.html' }).join()).toContain('entry');
  });
  it('.html 以外を弾く', () => {
    expect(errorsFor({ ...valid, entry: 'main.js' }).join()).toContain('entry');
  });
  it('サブフォルダの html は通る', () => {
    expect(validateManifest({ ...valid, entry: 'dist/index.html' }).ok).toBe(true);
  });
  it('percent-encode されたパストラバーサル（%2e%2e）を弾く', () => {
    expect(errorsFor({ ...valid, entry: '%2e%2e/secret.html' }).join()).toContain('entry');
  });
  it('percent-encode されたスラッシュ（%2f）を含むパスも弾く', () => {
    expect(errorsFor({ ...valid, entry: 'a%2fb.html' }).join()).toContain('entry');
  });
});

describe('validateManifest — permissions', () => {
  it('network は https のオリジンのみ', () => {
    expect(errorsFor({ ...valid, permissions: { network: ['http://x.com'] } }).join()).toContain('network');
    expect(errorsFor({ ...valid, permissions: { network: ['https://x.com/path'] } }).join()).toContain('network');
    expect(errorsFor({ ...valid, permissions: { network: ['x.com'] } }).join()).toContain('network');
  });
  it('workFiles の値を検査する', () => {
    expect(errorsFor({ ...valid, permissions: { workFiles: 'write' } }).join()).toContain('workFiles');
  });
  it('readScopes は文字列の配列', () => {
    expect(errorsFor({ ...valid, permissions: { readScopes: '3dss' } }).join()).toContain('readScopes');
    expect(validateManifest({ ...valid, permissions: { readScopes: ['3dss', '3dsl'] } }).ok).toBe(true);
  });
});

describe('validateManifest — contributes.verbs', () => {
  const withVerb = (v: unknown) => ({ ...valid, contributes: { verbs: [v] } });
  it('verb 名は snake_case', () => {
    expect(errorsFor(withVerb({ name: 'CreateEstimate', description: 'd', input: {}, risk: 'low' })).join()).toContain('name');
  });
  it('risk の値を検査する', () => {
    expect(errorsFor(withVerb({ name: 'a', description: 'd', input: {}, risk: 'huge' })).join()).toContain('risk');
  });
  it('妥当な verb は通る', () => {
    expect(validateManifest(withVerb({ name: 'create_estimate', description: 'd', input: {}, risk: 'medium' })).ok).toBe(true);
  });
});

describe('validateManifest — 未知のキー', () => {
  it('トップレベルの typo を弾く（早期発見のため）', () => {
    expect(errorsFor({ ...valid, permision: {} }).join()).toContain('permision');
  });
});
