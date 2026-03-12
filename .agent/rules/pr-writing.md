---
trigger: always_on
---

# Pull Request Writing Rule

When preparing a pull request, generate Japanese GitHub PR body in Markdown with:

## 概要
## 主な変更
## 追加された主な機能
## 影響範囲
## 確認ポイント
## テスト

Base the content on:

- git diff
- changed files
- commit messages

Do not invent changes.