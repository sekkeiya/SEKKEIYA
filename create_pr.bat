@echo off
chcp 65001
gh pr create --title "feat: AI補完バックエンドの推論精度向上とコンテキスト強化" -F .pr_body.md
gh pr merge --merge --delete-branch
