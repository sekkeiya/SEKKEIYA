// Web stub for native/desktop-only heavy modules (@huggingface/transformers, rhino3dm 等)。
// これらは Tauri/ネイティブ環境でのみ動作する重量級ライブラリ（オンデバイスML・3D CAD解析）で、
// ブラウザ（Web の /workspace 埋め込み）からは到達しない（機能自体がネイティブ前提でゲートされる）。
// vite.config.js の alias でこれらの動的 import() を本スタブへ振り、Web ビルドを通す。
// 万一 Web 側から利用されたら分かるよう、プロパティ利用時に明示エラーを投げる。
const stub = new Proxy(
  {},
  {
    get() {
      throw new Error('[web-stub] このモジュールはデスクトップ（ネイティブ）専用です。Web では利用できません。');
    },
  },
);

export default stub;
