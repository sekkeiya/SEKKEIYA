const { runNanobananaProvider } = require("./nanobananaProvider");
const { runFalFluxProvider } = require("./falFluxProvider");
const { runFluxLoraProvider } = require("./fluxLoraProvider");

const renderProviderFactory = {
  startJob: async (jobId, uid, data) => {
    const provider = data.provider || "nanobanana";
    switch (provider) {
      case "nanobanana":
        return runNanobananaProvider(jobId, uid, data);
      case "flux-schnell":
        // ⚠️ FAL_KEY 未設定の間は failed で返る（有効化手順は falFluxProvider.js 冒頭）
        return runFalFluxProvider(jobId, uid, data);
      case "flux-lora":
        // 公式LoRA（内観パース等）を載せた生成。data.loraId で選択（既定 interior-perspective）
        return runFluxLoraProvider(jobId, uid, data);
      default:
        throw new Error(`Unsupported AI Render provider: ${provider}`);
    }
  },
};

module.exports = { renderProviderFactory };
