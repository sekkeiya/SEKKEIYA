---
description: 【使い方】Antigravityのチャットで/draft-pr  と打つだけです。するとgit diff ↓ AI分析 ↓ PR文章生成  になります。
---

# draft-pr

Generate a GitHub Pull Request description in Japanese.

Steps:

1. Inspect git diff --stat main...HEAD
2. Inspect git diff main...HEAD
3. Inspect recent commit messages
4. Summarize the changes clearly.

Output format:

## 概要

## 主な変更

## 追加された主な機能

## 影響範囲

## 確認ポイント

## テスト