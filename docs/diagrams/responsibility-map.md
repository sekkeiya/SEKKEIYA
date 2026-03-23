
---

# 3. responsibility-map.md

```md
# Responsibility Map

```mermaid
flowchart LR
    A[SEKKEIYA]

    subgraph S[SEKKEIYAが持つもの]
        S1[プロジェクト]
        S2[フォロー / フォロワー]
        S3[AI Chatの会話文脈]
        S4[AI Driveの横断文脈]
        S5[通知]
        S6[全体プロフィール]
        S7[チーム / 招待]
        S8[横断検索]
    end

    subgraph C[子アプリが持つもの]
        C1[3DSS: モデル本体 / メタデータ]
        C2[3DSL: レイアウト / 配置]
        C3[3DSC: 生成ジョブ / 生成結果]
        C4[3DSP: プレゼン資料 / ページ要素]
        C5[3DSB: 書籍 / エピソード]
        C6[3DSQ: クエスト / 学習進行]
    end

    A --> S
    A --> C
