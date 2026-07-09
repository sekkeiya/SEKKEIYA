# Diagram Index (図の役割一覧と歩き方)

## 概要 (Overview)
このドキュメントは、SEKKEIYAエコシステムのドキュメント群 `docs/diagrams/` に蓄積された各アーキテクチャ図が、それぞれ「どの程度の視野 / 粒度」で「何を伝えるためのものか」を整理したインデックスです。

## 読む順番と役割一覧

### 1段階目：全体・マクロ視点 (The Big Picture)
| ファイル名 | 目的・役割 | 読むべき状況 |
| :--- | :--- | :--- |
| **`final-system-map.md`** | **(最重要)** SEKKEIYA 10-Layer Ecosystem 全体を表現する統合マップ。 | 全体構造や思想を知りたいとき。(迷ったらまずはこれを見る) |
| `core-system-map.md` | 同上（final-system-map のベーシック版）。 | 階層のシンプルな流れを知りたいとき。 |

### 2段階目：機能とアプリの責任分界 (Responsibilities & Apps)
| ファイル名 | 目的・役割 | 読むべき状況 |
| :--- | :--- | :--- |
| `responsibility-map.md` | SEKKEIYA OSと、3DSS/3DSL等のジェネレーターアプリが、それぞれどの層を管轄しているかの境界を示す。 | OSとアプリの責務を明確に切り分けたいとき。 |
| `project-app-scope-map.md` | Project Website内の各セクションが、どのジェネレーターアプリによって構築されるかのルーティング関係を示す。 | 新しいセクション追加時や、アプリ間の遷移・ルーティングを設計するとき。 |

### 3段階目：データ構造・ER (Datastructure)
| ファイル名 | 目的・役割 | 読むべき状況 |
| :--- | :--- | :--- |
| `project-sections-er.md` | `PROJECTS` → `SECTIONS` → `ITEMS` というフラットな親子関係のFirestore中核ER図。 | Project/Section周りのAPI開発・Firestoreルールの設定時。 |
| `firestore-er.md` | UserやAssetを含めた、Firebase全体の網羅的なER図。 | データベース全体のつながりや、Assetの実体保存箇所を確認するとき。 |

### 4段階目：動的フローとAI文脈 (Flow & AI)
| ファイル名 | 目的・役割 | 読むべき状況 |
| :--- | :--- | :--- |
| `project-generation-flow.md` | ユーザーが「Project作成」→「AI対話」→「ジェネレーターによるコンテンツ生成」→「Website公開」という体験を時系列フローで示す。 | ユーザーの利用体験シナリオを把握するとき。 |

## 各図に共通する重要思想
全ての図は以下の階層構造に基づき、**プロジェクトセントリック（1 Project = 1 Website）**な思想で表現されています。
`User` → `SEKKEIYA OS` → `Project Website` → `Sections` → `Items` → `Asset / Metadata` → `AI Drive` → `AI Chat` → `Generator Actions`
