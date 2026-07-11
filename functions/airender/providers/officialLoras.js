/**
 * SEKKEIYA 公式LoRA レジストリ
 * -----------------------------------------------------------------------------
 * airender の flux-lora プロバイダが参照する「公式（SEKKEIYA製）LoRA」の台帳。
 * 学習は tools/lora/ の PoC ハーネスで行い、出力された manifest の lora_url を
 * ここに登録する。対義は将来の user-lora（ユーザー作成LoRA・Phase2）。
 *
 * ⚠️ url は fal のトレーニング出力URL。当面はこれを直参照するが、恒久運用では
 *    自前 Storage に再ホストしてURL失効リスクを消すのが望ましい（TODO）。
 */

const OFFICIAL_LORAS = {
  "interior-perspective": {
    label: "内観パース v1",
    base: "flux", // fal-ai/flux-lora（FLUX.1[dev] + LoRA）
    url: "https://v3b.fal.media/files/b/0aa1c5f9/ZrX-bq1NyhyHuPiUQWfvQ_pytorch_lora_weights.safetensors",
    triggerWord: "skvintr",
    scale: 1.0,
    trainedAt: "2026-07-11",
    // PoCシード（FLUX-schnell自家蒸留12枚）で学習した第一号。本命の教師データは
    // S.Layout / S.Image の自前レンダに差し替えて再学習する前提。
    note: "PoC seed-trained (FLUX self-distill). Replace with S.Layout/S.Image renders.",
  },
};

const DEFAULT_LORA_ID = "interior-perspective";

function getOfficialLora(loraId) {
  const id = loraId || DEFAULT_LORA_ID;
  return { id, ...(OFFICIAL_LORAS[id] || null) };
}

module.exports = { OFFICIAL_LORAS, DEFAULT_LORA_ID, getOfficialLora };
