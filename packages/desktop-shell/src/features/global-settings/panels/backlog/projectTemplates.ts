// 要件76: 新規プロジェクトの種別テンプレート。
// 空フォルダから始めるより、種別を選んで最低限の雛形が出るほうが着手が速い。
// ここは「どのパスにどの中身を書くか」を返すだけの純ロジック（fs は DevStatusPanel 側）。
//
// 各テンプレートは既定の検証コマンド（要件78）も持つ。作成時に project.json へ書き込まれ、
// Claude Code の /queue が実装後に実行する。
import type { VerifyCommand } from './projectConfig';

export interface TemplateFile { path: string; content: string; }

export type TemplateId = 'empty' | 'web' | 'node-cli' | 'docs';

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
];

export const DEFAULT_TEMPLATE_ID: TemplateId = 'empty';

export function templateById(id: string): ProjectTemplate {
  return PROJECT_TEMPLATES.find(t => t.id === id)
    ?? PROJECT_TEMPLATES.find(t => t.id === DEFAULT_TEMPLATE_ID)!;
}
