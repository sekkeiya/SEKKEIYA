// 要件76: 新規プロジェクトの種別テンプレート。
// 空フォルダから始めるより、種別を選んで最低限の雛形が出るほうが着手が速い。
// ここは「どのパスにどの中身を書くか」を返すだけの純ロジック（fs は DevStatusPanel 側）。
//
// 各テンプレートは既定の検証コマンド（要件78）も持つ。作成時に project.json へ書き込まれ、
// Claude Code の /queue が実装後に実行する。
import type { VerifyCommand } from './projectConfig';

export interface TemplateFile { path: string; content: string; }

export type TemplateId = 'empty' | 'web' | 'node-cli' | 'docs' | 'plugin';

export interface ProjectTemplate {
  id: TemplateId;
  label: string;
  /** ダイアログに出す 1 行説明。 */
  description: string;
  /** 作成直後に project.json へ書く既定の検証コマンド。 */
  verify: VerifyCommand[];
  /** 生成するファイル一覧。projectName は表示名（日本語可）。 */
  files: (projectName: string) => TemplateFile[];
}

/**
 * 表示名から npm の package.json `name` に使える文字列を作る。
 * 日本語などの非 ASCII は落ちるため、空になったら 'app' にフォールバックする。
 */
export function toPackageName(projectName: string): string {
  const slug = projectName
    .trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')  // 使えない文字はハイフンへ
    .replace(/^[-._]+|[-._]+$/g, '') // 先頭末尾の記号は npm が嫌う
    .slice(0, 214);
  return slug || 'app';
}

/**
 * 表示名から plugin.json の id（逆ドメイン形式）に使えるセグメントを作る（要件68）。
 * validateManifest の ID_RE（小文字英数とハイフン・先頭末尾ハイフン不可）に合わせる。
 */
export function pluginIdFromName(projectName: string): string {
  const seg = toPackageName(projectName)
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return `local.${seg || 'plugin'}`;
}

const GITIGNORE = `node_modules/
dist/
build/
*.log
.DS_Store
.env
.env.local
`;

/** どのテンプレートにも入る先頭の README。SEKKEIYA Code 側の使い方だけ書く。 */
function readmeHeader(projectName: string): string {
  return `# ${projectName}

SEKKEIYA Code で作成したプロジェクトです。

- 要求・要件は \`.claude/sekkeiya-code/backlog.json\`（SEKKEIYA Code アプリが読み書きします）
- 検証コマンドは \`.claude/sekkeiya-code/project.json\` の \`verify[]\`
- 実装は Claude Code をこのフォルダで起動し \`/queue\` を実行します
`;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'empty',
    label: '空のプロジェクト',
    description: 'README と .gitignore だけ。中身は自分で決める。',
    verify: [],
    files: (name) => [
      { path: 'README.md', content: readmeHeader(name) },
      { path: '.gitignore', content: GITIGNORE },
    ],
  },
  {
    id: 'web',
    label: 'Web アプリ（Vite + React + TypeScript）',
    description: 'ブラウザで動く SPA の雛形。作成後に npm install が必要。',
    verify: [
      { label: '型チェック', command: 'npx tsc --noEmit' },
      { label: 'ビルド', command: 'npm run build' },
    ],
    files: (name) => [
      {
        path: 'README.md',
        content: `${readmeHeader(name)}
## 使い方

\`\`\`bash
npm install
npm run dev
\`\`\`

初回は \`npm install\` を実行してください（それまで型チェック・ビルドは通りません）。
`,
      },
      { path: '.gitignore', content: GITIGNORE },
      {
        path: 'package.json',
        content: JSON.stringify({
          name: toPackageName(name),
          private: true,
          version: '0.1.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc --noEmit && vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^19.2.0',
            'react-dom': '^19.2.0',
          },
          devDependencies: {
            '@types/react': '^19.2.0',
            '@types/react-dom': '^19.2.0',
            '@vitejs/plugin-react': '^6.0.0',
            typescript: '~5.9.0',
            vite: '^8.0.0',
          },
        }, null, 2) + '\n',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            isolatedModules: true,
            resolveJsonModule: true,
            verbatimModuleSyntax: true,
          },
          include: ['src', 'vite.config.ts'],
        }, null, 2) + '\n',
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`,
      },
      {
        path: 'index.html',
        content: `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      },
      {
        path: 'src/main.tsx',
        content: `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root が見つかりません');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
      },
      {
        path: 'src/App.tsx',
        content: `export function App() {
  return (
    <main>
      <h1>${name}</h1>
      <p>ここから作り始めてください。</p>
    </main>
  );
}
`,
      },
      {
        path: 'src/index.css',
        content: `:root {
  font-family: system-ui, sans-serif;
  line-height: 1.6;
}

body {
  margin: 0;
  padding: 2rem;
}
`,
      },
    ],
  },
  {
    id: 'node-cli',
    label: 'CLI ツール（Node.js）',
    description: 'コマンドラインツールの雛形。依存なしで npm test がそのまま通る。',
    verify: [{ label: 'テスト', command: 'npm test' }],
    files: (name) => {
      const pkg = toPackageName(name);
      return [
        {
          path: 'README.md',
          content: `${readmeHeader(name)}
## 使い方

\`\`\`bash
node bin/cli.mjs あなたの名前
npm test
\`\`\`

依存パッケージはありません（Node.js 標準の \`node --test\` を使います）。
`,
        },
        { path: '.gitignore', content: GITIGNORE },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: pkg,
            private: true,
            version: '0.1.0',
            type: 'module',
            bin: { [pkg]: 'bin/cli.mjs' },
            scripts: {
              start: 'node bin/cli.mjs',
              test: 'node --test',
            },
          }, null, 2) + '\n',
        },
        {
          path: 'bin/cli.mjs',
          content: `#!/usr/bin/env node
// ${name} — CLI エントリポイント。
// ロジックは export して test/ から直接呼べるようにしておく。
import { pathToFileURL } from 'node:url';

export function greet(name = 'world') {
  return \`Hello, \${name}!\`;
}

// 直接実行されたときだけ標準出力へ（import 時は何もしない）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(greet(process.argv[2]));
}
`,
        },
        {
          path: 'test/cli.test.mjs',
          content: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greet } from '../bin/cli.mjs';

test('引数なしなら world に挨拶する', () => {
  assert.equal(greet(), 'Hello, world!');
});

test('引数の名前を使う', () => {
  assert.equal(greet('${name.replace(/'/g, "\\'")}'), 'Hello, ${name.replace(/'/g, "\\'")}!');
});
`,
        },
      ];
    },
  },
  {
    id: 'docs',
    label: 'ドキュメント / 調査メモ',
    description: 'コードを持たない、資料と決めごとをためるプロジェクト。',
    verify: [],
    files: (name) => [
      {
        path: 'README.md',
        content: `${readmeHeader(name)}
## 構成

- \`docs/\` — 資料・調査メモ・決めごと
`,
      },
      { path: '.gitignore', content: GITIGNORE },
      {
        path: 'docs/00_index.md',
        content: `# ${name} — 目次

| ファイル | 内容 |
|---|---|
| （まだありません） | |
`,
      },
    ],
  },
  {
    id: 'plugin',
    label: 'SEKKEIYA プラグイン',
    description: 'タブに出る子アプリの雛形。ビルド不要（HTML + JS）で、設定→プラグインからパッケージ化・公開できる。',
    verify: [],
    files: (name) => {
      const displayName = name.trim().slice(0, 60) || 'Plugin';
      const pluginId = pluginIdFromName(name);
      return [
        {
          path: 'README.md',
          content: `${readmeHeader(name)}
## これは何

SEKKEIYA のタブに出る子アプリ（プラグイン）の雛形です。ビルド工程はありません。
\`plugin.json\`（manifest）と \`index.html\`（画面）を編集するだけで動きます。

## 動作確認の手順

1. このフォルダごと \`%USERPROFILE%\\SEKKEIYA\\Plugins\\\` にコピーする
   （または SEKKEIYA の 設定 → プラグイン → 「パッケージ化」で dist/ に zip を作り、「zip からインストール」する）
2. SEKKEIYA の 設定 → プラグイン → 「再読み込み」
3. タブバーの末尾に「${displayName}」タブが出る

## API

プラグインから使える SEKKEIYA の機能は \`docs/plugin-api.md\` を参照してください。
\`sekkeiya-api.js\` を \`<script src="./sekkeiya-api.js"></script>\` で読み込むと
\`window.sekkeiya\` から呼べます。

## 配布

- 設定 → プラグイン → 「パッケージ化」 … \`dist/<id>-<version>.zip\` を作る（手渡し配布用）
- 設定 → プラグイン → 「公開」 … マーケットプレイスに公開する（全ユーザーが導入可能になる）
`,
        },
        { path: '.gitignore', content: GITIGNORE },
        {
          path: 'plugin.json',
          content: JSON.stringify({
            id: pluginId,
            name: displayName,
            version: '0.1.0',
            engine: '^1.0.0',
            entry: 'index.html',
            color: '#90a4ae',
            contributes: { tab: { label: displayName } },
          }, null, 2) + '\n',
        },
        {
          path: 'index.html',
          content: `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>${displayName}</title>
  <style>
    :root { color-scheme: dark light; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; line-height: 1.7; }
    button { padding: 6px 16px; border-radius: 6px; border: 1px solid #888; cursor: pointer; }
    .muted { opacity: 0.65; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${displayName}</h1>
  <p id="ctx" class="muted">コンテキストを読み込み中...</p>
  <p>
    <button id="count">カウント +1</button>
    <span id="value">0</span>
    <span class="muted">（sekkeiya.storage に保存されます）</span>
  </p>
  <script src="./sekkeiya-api.js"></script>
  <script>
    var ctxEl = document.getElementById('ctx');
    var valueEl = document.getElementById('value');

    sekkeiya.context.get().then(function (ctx) {
      ctxEl.textContent = 'プロジェクト: ' + (ctx.projectName || '(未選択)');
    }).catch(function (e) {
      ctxEl.textContent = 'context.get に失敗: ' + e.message;
    });

    function render(v) { valueEl.textContent = String(v == null ? 0 : v); }
    sekkeiya.storage.get('count').then(render);

    document.getElementById('count').addEventListener('click', function () {
      sekkeiya.storage.get('count').then(function (v) {
        var next = (v == null ? 0 : Number(v)) + 1;
        return sekkeiya.storage.set('count', next).then(function () { render(next); });
      });
    });
  </script>
</body>
</html>
`,
        },
        {
          path: 'sekkeiya-api.js',
          content: `// SEKKEIYA プラグイン API クライアント（雛形に同梱・依存なし）。
// window.sekkeiya として公開する。仕様は docs/plugin-api.md を参照。
// 本体側の窓口は postMessage RPC（sekkeiya:req / sekkeiya:res）。
(function () {
  'use strict';
  var REQ = 'sekkeiya:req';
  var RES = 'sekkeiya:res';
  var EVT = 'sekkeiya:event';
  var TIMEOUT_MS = 10000;
  var seq = 0;
  var pending = {};
  var verbHandlers = {};

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === RES) {
      var p = pending[d.id];
      if (!p) return;
      clearTimeout(p.timer);
      delete pending[d.id];
      if (d.ok) p.resolve(d.result);
      else p.reject(new Error(d.error));
      return;
    }
    if (d.type === EVT && typeof d.name === 'string' && d.name.indexOf('verb:') === 0) {
      var h = verbHandlers[d.name.slice(5)];
      if (h) h(d.payload || {});
    }
  });

  function call(method, params) {
    var id = 'p' + (++seq);
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete pending[id];
        reject(new Error(method + ' が応答しませんでした（' + TIMEOUT_MS + 'ms）'));
      }, TIMEOUT_MS);
      pending[id] = { resolve: resolve, reject: reject, timer: timer };
      window.parent.postMessage({ type: REQ, id: id, method: method, params: params }, '*');
    });
  }

  window.sekkeiya = {
    context: { get: function () { return call('context.get'); } },
    workFiles: {
      list: function (q) { return call('workFiles.list', q || {}); },
      get: function (id) { return call('workFiles.get', { id: id }); },
      create: function (input) { return call('workFiles.create', input); },
      update: function (id, patch) {
        patch = patch || {};
        return call('workFiles.update', { id: id, name: patch.name, data: patch.data });
      },
      remove: function (id) { return call('workFiles.remove', { id: id }); }
    },
    ui: {
      setSelection: function (item) { return call('ui.setSelection', { item: item }); },
      toast: function (message, level) { return call('ui.toast', { message: message, level: level || 'info' }); },
      confirm: function (message) { return call('ui.confirm', { message: message }); },
      setTitle: function (title) { return call('ui.setTitle', { title: title }); }
    },
    http: { request: function (req) { return call('http.request', req); } },
    chat: { send: function (text) { return call('chat.send', { text: text }); } },
    verbs: { on: function (name, handler) { verbHandlers[name] = handler; } },
    storage: {
      get: function (key) { return call('storage.get', { key: key }); },
      set: function (key, value) { return call('storage.set', { key: key, value: value }); }
    }
  };
})();
`,
        },
        {
          path: 'docs/plugin-api.md',
          content: `# SEKKEIYA プラグイン API（engine ^1.0.0）

Claude Code への指示: このプラグインを実装するとき、このファイルの範囲だけを使うこと。
ここに無い機能（本体のストア・Firestore・Tauri invoke）はプラグインからは触れない。

## plugin.json（manifest）

| フィールド | 必須 | 内容 |
|---|---|---|
| id | ✔ | 逆ドメイン形式（例: \`local.my-tool\`）。データ分離キーを兼ねる |
| name | ✔ | 表示名（60 文字まで） |
| version | ✔ | プラグイン自身の semver |
| engine | ✔ | 対応 API バージョン。\`"^1.0.0"\` か \`"1.0.0"\` のみ |
| entry | ✔ | iframe に読ませる HTML（ルートからの相対パス・\`.html\`） |
| icon / color | | タブの見た目 |
| contributes.tab.label | | タブに出す名前。無ければタブは出ない |
| contributes.verbs | | AI verb の宣言（name / description / input / risk） |
| permissions | | 下記。宣言していない機能の呼び出しは拒否される |

### permissions

| キー | 内容 |
|---|---|
| workFiles | \`"read"\` / \`"readwrite"\` — 自分の領域の作業ファイル |
| readScopes | 読み取りを許す他サブアプリの appScope（**自分で置いたプラグインのみ有効**） |
| network | 通信を許す https オリジンの配列（例: \`["https://api.example.com"]\`） |
| chat | SEKKEIYA Chat への送信を許すか（真偽値） |

インストール時にユーザーへ権限一覧が提示され、同意した場合のみ有効になる。

## window.sekkeiya（sekkeiya-api.js）

すべて Promise を返す。

- \`sekkeiya.context.get()\` → \`{ projectId, projectName, userId, locale, theme }\`
- \`sekkeiya.workFiles.list({ appScope?, limit? }) / get(id) / create({ name, data }) / update(id, { name?, data? }) / remove(id)\`
- \`sekkeiya.ui.toast(message, level?) / confirm(message) / setTitle(title) / setSelection(item)\`
- \`sekkeiya.http.request({ url, method?, headers?, body? })\` — permissions.network の宣言が必要
- \`sekkeiya.chat.send(text)\` — permissions.chat の宣言が必要
- \`sekkeiya.verbs.on(name, handler)\` — contributes.verbs で宣言した verb の実装を登録
- \`sekkeiya.storage.get(key) / set(key, value)\` — プラグイン専用の永続化（64KB/値・100 キーまで）

### 現時点で本体に接続済みのもの

\`context.get\` / \`ui.confirm\` / \`storage.get\` / \`storage.set\`。
それ以外は呼ぶと「まだ本体に接続されていません」エラーが返る（本体側の配線待ち）。
実装はエラーをハンドリングして、接続済み API だけで成立する UI にすること。
`,
        },
      ];
    },
  },
];

export const DEFAULT_TEMPLATE_ID: TemplateId = 'empty';

export function templateById(id: string): ProjectTemplate {
  return PROJECT_TEMPLATES.find(t => t.id === id)
    ?? PROJECT_TEMPLATES.find(t => t.id === DEFAULT_TEMPLATE_ID)!;
}
