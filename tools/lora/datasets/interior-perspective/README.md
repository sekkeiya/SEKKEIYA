# 教師画像キュレーション — 内観パース (interior-perspective)

このフォルダの `images/` に教師画像を置くと、`lora-poc.mjs train interior-perspective` で学習できます。

## 置き方
- `images/img01.jpg`, `images/img02.png` … （jpg / jpeg / png / webp）
- キャプションを付ける場合は同名 `.txt`：`images/img01.jpg` ↔ `images/img01.txt`
  - キャプション例: `skvintr, a bright modern living room, wooden floor, large windows, soft daylight, wide-angle interior render`
  - キャプションなしでも学習可（その場合 `trigger_word` が全画像の合言葉になる）

## 権利（最重要）
- **自分が権利を持つ画像だけ**を使う。今回のPoCは以下のいずれか:
  - ① SEKKEIYA自身のレンダ（S.Layout / S.Model / S.Image の出力、既存プロジェクトのパース）
  - ④ PoC当座の少数シード（作風の当たりを見る用の使い捨て）
- 他社サイトからの拾い画像・商用ストックの無断利用は不可。

## 良い教師データの条件（内観パース向け）
- **枚数**: 最低4枚（動くだけ）、**推奨15〜30枚**。PoCは10〜15枚でも作風は掴める。
- **解像度**: 1024px以上（長辺）、圧縮ノイズの少ないもの。正方1024近辺が無難。
- **一貫性**: 「学ばせたい作風」を揃える。SEKKEIYAらしい内観パースの
  - 光（自然光/柔らかい陰影）、質感（木・白壁・ファブリック）、構図（広角・アイレベル）
  を統一するほど作風が濃く出る。バラバラだと平均化して薄まる。
- **避ける**: 透かし・UI・人物の顔が主役・極端な魚眼・強いInstagramフィルタ。

## パラメータ（config.json）
- `trigger_word`: 作風を呼び出す合言葉。既定 `skvintr`（造語）。生成時プロンプト先頭に自動付与される。
- `steps`: 既定 1000（fal課金 ~$2 の目安）。増やすと濃くなるが過学習リスク＆課金増。
- `is_style`: `true`（作風学習）。特定の1室/1オブジェクトを覚えさせたい場合のみ `false`。

## 実行
```powershell
cd C:\Users\sekkeiya\02-WebApp\040-sekkeiya\sekkeiya\tools\lora
node lora-poc.mjs train interior-perspective
# → out/interior-perspective-<ts>.lora.json （LoRA URL入り）が出る
node lora-poc.mjs generate "out/interior-perspective-<ts>.lora.json" "a bright modern living room, large windows, daylight"
# → out/interior-perspective-gen-<ts>.png
```
