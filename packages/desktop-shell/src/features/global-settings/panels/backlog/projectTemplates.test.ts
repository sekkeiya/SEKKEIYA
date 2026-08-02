import { describe, it, expect } from 'vitest';
import { PROJECT_TEMPLATES, templateById, toPackageName, pluginIdFromName, DEFAULT_TEMPLATE_ID } from './projectTemplates';
import { validateVerifyCommand } from './projectConfig';
import { validateManifest } from '../../../plugins/manifest/validateManifest';

describe('toPackageName', () => {
  it('そのまま使える名前は小文字化するだけ', () => {
    expect(toPackageName('MyApp')).toBe('myapp');
    expect(toPackageName('my-cli-tool')).toBe('my-cli-tool');
  });
  it('空白や記号はハイフンにまとめる', () => {
    expect(toPackageName('my  cool app')).toBe('my-cool-app');
  });
  it('日本語だけの名前は app にフォールバックする（npm 名に使えないため）', () => {
    expect(toPackageName('設計屋')).toBe('app');
  });
  it('先頭末尾の記号を落とす', () => {
    expect(toPackageName('__app__')).toBe('app');
    expect(toPackageName('.hidden.')).toBe('hidden');
  });
});

describe('templateById', () => {
  it('id で引ける', () => {
    expect(templateById('web').id).toBe('web');
    expect(templateById('node-cli').id).toBe('node-cli');
  });
  it('未知の id は既定テンプレートにフォールバックする', () => {
    expect(templateById('nope').id).toBe(DEFAULT_TEMPLATE_ID);
    expect(templateById('').id).toBe(DEFAULT_TEMPLATE_ID);
  });
});

describe('PROJECT_TEMPLATES', () => {
  it('id が重複していない', () => {
    const ids = PROJECT_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const t of PROJECT_TEMPLATES) {
    describe(t.id, () => {
      const files = t.files('テスト用アプリ');

      it('README と .gitignore を必ず含む', () => {
        const paths = files.map(f => f.path);
        expect(paths).toContain('README.md');
        expect(paths).toContain('.gitignore');
      });
      it('パスが相対で、上位へ脱出しない', () => {
        for (const f of files) {
          expect(f.path.startsWith('/')).toBe(false);
          expect(f.path).not.toContain('..');
          expect(f.path).not.toContain('\\');
        }
      });
      it('パスが重複していない', () => {
        const paths = files.map(f => f.path);
        expect(new Set(paths).size).toBe(paths.length);
      });
      it('中身が空のファイルを作らない', () => {
        for (const f of files) expect(f.content.length).toBeGreaterThan(0);
      });
      it('.claude 配下はテンプレートから作らない（アプリが管理するため）', () => {
        for (const f of files) expect(f.path.startsWith('.claude/')).toBe(false);
      });
      it('既定の検証コマンドが妥当', () => {
        for (const v of t.verify) {
          expect(validateVerifyCommand(v.command)).toBeNull();
          expect(v.label.length).toBeGreaterThan(0);
        }
      });
      it('生成した JSON はパースできる', () => {
        for (const f of files.filter(f => f.path.endsWith('.json'))) {
          expect(() => JSON.parse(f.content)).not.toThrow();
        }
      });
    });
  }

  it('web テンプレートの package.json は名前をスラッグ化して入れる', () => {
    const pkg = templateById('web').files('設計屋 App').find(f => f.path === 'package.json')!;
    expect(JSON.parse(pkg.content).name).toBe('app');
  });

  it('node-cli の bin は package.json の name と一致する', () => {
    const files = templateById('node-cli').files('My CLI');
    const pkg = JSON.parse(files.find(f => f.path === 'package.json')!.content);
    expect(pkg.name).toBe('my-cli');
    expect(pkg.bin).toEqual({ 'my-cli': 'bin/cli.mjs' });
    expect(files.map(f => f.path)).toContain('bin/cli.mjs');
  });

  it('node-cli のテンプレートは ${…} を文字列として保つ（テンプレートリテラルの誤展開が無い）', () => {
    const cli = templateById('node-cli').files('X').find(f => f.path === 'bin/cli.mjs')!;
    expect(cli.content).toContain('Hello, ${name}!');
  });

  it('空テンプレートは検証コマンドを持たない', () => {
    expect(templateById('empty').verify).toEqual([]);
  });
});

describe('pluginIdFromName（要件68）', () => {
  it('逆ドメイン形式のセグメントに整形する', () => {
    expect(pluginIdFromName('My Tool')).toBe('local.my-tool');
    expect(pluginIdFromName('見積ツール')).toBe('local.app'); // 日本語は toPackageName で落ちる
    expect(pluginIdFromName('a..b__c')).toBe('local.a-b-c');
  });
  it('空になったら plugin にフォールバックする', () => {
    expect(pluginIdFromName('。。。')).toBe('local.app');
  });
});

describe('plugin テンプレート（要件68）', () => {
  const files = templateById('plugin').files('見積 Tool');

  it('生成した plugin.json は validateManifest を通る', () => {
    const raw = JSON.parse(files.find(f => f.path === 'plugin.json')!.content);
    const result = validateManifest(raw);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.manifest.entry).toBe('index.html');
    expect(result.manifest.engine).toBe('^1.0.0');
    expect(result.manifest.contributes?.tab?.label).toBe('見積 Tool');
  });
  it('entry と API クライアントと API ドキュメントを同梱する', () => {
    const paths = files.map(f => f.path);
    expect(paths).toContain('index.html');
    expect(paths).toContain('sekkeiya-api.js');
    expect(paths).toContain('docs/plugin-api.md');
  });
  it('index.html は同梱の sekkeiya-api.js を読み込む', () => {
    const html = files.find(f => f.path === 'index.html')!.content;
    expect(html).toContain('<script src="./sekkeiya-api.js"></script>');
  });
  it('長い表示名は manifest の name 上限（60 文字）に収める', () => {
    const long = 'あ'.repeat(80);
    const raw = JSON.parse(templateById('plugin').files(long).find(f => f.path === 'plugin.json')!.content);
    expect(raw.name.length).toBeLessThanOrEqual(60);
    expect(validateManifest(raw).ok).toBe(true);
  });
});
