// 対象リポに書き込む /queue スキル（.claude/skills/queue/SKILL.md）。
// SEKKEIYA Code ローカルモードの backlog.json を Claude Code が直接読み書きする契約書。
//
// 要件79: SEKKEIYA 本体の開発を前提にした書き方をしない。どんなアプリのリポジトリに置いても
//   そのまま意味が通る文面にする（このスキルは SEKKEIYA と無関係なプロジェクトにも配られる）。
// 要件78: 検証コマンドは project.json の verify[] を読んで実行する。コマンドを変えても
//   このスキルは書き直さなくてよい。
export const QUEUE_SKILL_MD = `---
name: queue
description: SEKKEIYA Code のキュー（実装/テスト依頼）を取得して処理する
---

# SEKKEIYA Code キュー処理

このリポジトリの開発バックログは \`.claude/sekkeiya-code/backlog.json\` にあります
（SEKKEIYA Code アプリが管理。整形 JSON・2スペース・キー順安定）。

## データ契約
- \`items[]\`: 要求（type: "request"）と要件（type: "requirement"）。要件は \`requestId\` で親要求に紐づく。
- 主なフィールド: \`id\`(uuid) / \`seq\`(表示番号) / \`title\`(内容・本文) / \`status\`(todo|doing|testing|manualtest|rework|done|archived) /
  \`queue\`("implement"|"test"|null) / \`queuedAt\`(ISO) / \`testResult\`(テスト結果) / \`reason\`(理由) / \`notes\`(申し送り) /
  \`fixes[]\`(修正項目 \`{ id, text, done }\`) / \`attachments[]\`。
- 添付画像: \`attachments[].path\` は \`.claude/sekkeiya-code/\` からの相対パス。Read ツールで画像を開き、
  赤枠などの視覚指示を実装に反映すること。
- 時刻は ISO 8601 文字列、id は uuid。**キーの順序・整形を崩さず**編集すること（項目の追加/変更のみ行い、
  ファイル全体の再構成はしない）。

## 検証コマンド
\`.claude/sekkeiya-code/project.json\` の \`verify[]\` に、このプロジェクトの検証コマンドが登録されています。

\`\`\`json
{ "version": 1, "verify": [ { "label": "型チェック", "command": "npx tsc --noEmit" } ] }
\`\`\`

実装のあと **登録順に全部実行**し、すべて成功したら合格です。
\`verify\` が空、またはファイルが無い場合は、このリポジトリの流儀（README / package.json の scripts）に
従って自分で判断してください。

## /queue の手順
1. \`backlog.json\` を読み、\`queue\` が null でない項目を列挙する。
2. 各項目について:
   - \`queue: "implement"\` → 内容(\`title\`)・理由(\`reason\`)・添付を読んで実装する。続けて上の検証コマンドを実行する。
     - すべて成功 → \`status\` を "done"（目視確認が要る見た目・操作系なら "manualtest"）に更新。
     - 失敗 → \`status\` を "rework" にし、\`notes\` に失敗したコマンドと出力の要点を書く。
   - \`queue: "test"\` → テスト観点を整理して検証を支援し、結果を \`testResult\` に記録する。
3. 処理した項目は \`queue\` を null にし、\`queuedAt\` キーを削除する。\`updatedAt\` を現在時刻(ISO)に更新する。
4. 変更点をユーザーに要約報告する（何を実装し、どの項目をどの状態にしたか、検証コマンドの結果）。

## 注意
- backlog.json は SEKKEIYA Code アプリも同時に開いている可能性がある。編集は読み直してから最小差分で。
- 不明点があれば項目の \`notes\` を読み、それでも曖昧なら実装前にユーザーへ確認する。
`;
