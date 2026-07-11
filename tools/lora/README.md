# SEKKEIYA LoRA PoC ハーネス

公式LoRA第一号（内観パース）の **Phase1-a** 用 dev ツール。
「教師画像キュレーション → fal.ai で LoRA を1本学習 → 1枚生成」を回す。
本番 `functions/airender` とは独立（デプロイ対象外）。

- ベース: **FLUX.1**（本番 airender の `flux-schnell` と同系）
- 学習: `fal-ai/flux-lora-fast-training`（1回 ~$2・数分・GPU不要）
- 推論: `fal-ai/flux-lora`

> なぜ fal で学習？ 公式LoRAの**学習は一度きりの開発作業**。ローカルGPU(RTX 3060 Ti/8GB)は
> FLUXのLoRA学習には手狭。**「ローカルGPU＝原価≒0」の差別化は推論側**（各ユーザーが完成LoRAで
> 画像を出す所）で活きる話で、学習の置き場所とは別。詳細は memory `project_image_gen_lora_strategy`。

## セットアップ
```powershell
cd C:\Users\sekkeiya\02-WebApp\040-sekkeiya\sekkeiya\tools\lora
npm install          # 済んでいれば不要
# FAL_KEY を用意（どちらか）
#   A) $env:FAL_KEY = "xxxx:yyyy"
#   B) tools/lora/.env.local に  FAL_KEY=xxxx:yyyy  を1行（gitignore済）
```
fal.ai の API Key は https://fal.ai/dashboard/keys で取得。**このキーはあなたが用意**（Claudeは平文キーを扱いません）。

## 手順
1. `datasets/interior-perspective/images/` に教師画像を入れる（→ `datasets/interior-perspective/README.md` のキュレーション指針）
2. 学習：
   ```powershell
   node lora-poc.mjs train interior-perspective
   ```
   → `out/interior-perspective-<ts>.lora.json`（LoRA URL入り manifest）
3. 生成（1枚）：
   ```powershell
   node lora-poc.mjs generate "out/interior-perspective-<ts>.lora.json" "a bright modern living room, large windows, daylight"
   ```
   → `out/interior-perspective-gen-<ts>.png`

## 生成オプション
`--scale 1.0`（LoRAの効き）/ `--steps 28`（推論ステップ）/ `--size landscape_4_3`（`square_hd` 等も可）

## PoC が通ったら（次フェーズ）
- 本番 `functions/airender` に `flux-lora` プロバイダを追加し、manifest の LoRA URL を参照して
  エンドユーザー生成に載せる（`pricing.js` / `providerFactory.js` / desktop の provider 一覧）。
- ローカル推論（ComfyUI + FLUX fp8）で「原価≒0」ストーリーを検証。
