// プラグイン iframe に渡す sandbox 属性の値（要件65）。
//
// allow-same-origin を付けないことがこの機能の安全性のすべて。付けると iframe が本体と
// 同一オリジン扱いになり、本体の localStorage と Firebase セッションに到達できてしまう＝
// 隔離が見た目だけになる。この 1 語が隔離の全てなので、動かないからといって足さないこと。
//
// この定数を PluginFrame.tsx（.tsx なので Vitest の include 対象外）から切り出して
// .ts にしているのは、sandboxAttribute.test.ts で機械的に検証できるようにするため。
export const PLUGIN_IFRAME_SANDBOX = 'allow-scripts';
