/**
 * textPolish — Alt+Shift+S でフォーカス中の入力欄のテキストをAIが整文する。
 *
 * 音声入力（Alt+S → Win+H ディクテーション）の認識結果は句読点・改行・
 * フィラー（「えーと」等）が乱れがちなので、CF `polishText`（Gemini Flash-Lite級）
 * に渡して自然な文章に整えて置き換える。手入力の乱雑なメモにもそのまま使える。
 *
 * - 対象: input（テキスト系 type）と textarea。リッチエディタ(contentEditable)は対象外。
 * - 選択範囲があればその部分だけ、なければ全文を整文する。
 * - 処理中は入力欄を readOnly + 半透明にし、完了時に選択状態を復元する。
 * - 整文の待ち時間中にユーザーが別の場所を編集した場合は安全のため破棄する
 *   （送信時のテキストと現在値が一致する時だけ置き換える）。
 *
 * CF 側（別リポ sekkeiya functions）の実装案は docs/polish_text_function_draft.md。
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/client';
import { getTaskModel } from '../store/useAiSettingsStore';

/* ─────────── 有効/無効設定（Global Settings > 音声）: localStorage永続 ─────────── */
const TEXT_POLISH_KEY = 'sekkeiya-text-polish-enabled';

/** Alt+Shift+S 整文ショートカットが有効か（既定: 有効）。 */
export function isTextPolishEnabled(): boolean {
  try { return localStorage.getItem(TEXT_POLISH_KEY) !== '0'; } catch { return true; }
}

/** Alt+Shift+S 整文ショートカットの有効/無効を切り替える（即時反映・再起動不要）。 */
export function setTextPolishEnabled(on: boolean): void {
  try { localStorage.setItem(TEXT_POLISH_KEY, on ? '1' : '0'); } catch { /* noop */ }
}

/* ─────────────────────────────────────────────────────────────────────────── */

type TextField = HTMLInputElement | HTMLTextAreaElement;

/** 整文対象にできる input の type。パスワードや数値などは対象外。 */
const POLISHABLE_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', '']);

function asPolishableField(el: Element | null): TextField | null {
  if (el instanceof HTMLTextAreaElement) {
    return el.readOnly || el.disabled ? null : el;
  }
  if (el instanceof HTMLInputElement) {
    if (el.readOnly || el.disabled) return null;
    return POLISHABLE_INPUT_TYPES.has(el.type) ? el : null;
  }
  return null;
}

/** React の controlled input にも反映されるように、ネイティブ setter 経由で
 *  値を書き込み input イベントを発火する（直接 el.value 代入だと React が検知しない）。 */
function setNativeValue(el: TextField, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

let inflight = false;

async function polishFocusedField(el: TextField): Promise<void> {
  const fullText = el.value;
  const selStart = el.selectionStart ?? 0;
  const selEnd = el.selectionEnd ?? 0;
  const hasSelection = selEnd > selStart;
  const target = hasSelection ? fullText.slice(selStart, selEnd) : fullText;
  if (!target.trim()) return;

  inflight = true;
  const prevOpacity = el.style.opacity;
  el.readOnly = true;
  el.style.opacity = '0.55';
  try {
    const fn = httpsCallable(functions, 'polishText', { timeout: 20000 });
    // 用途別モデル設定（サーバー対応まではサーバー側で無視）
    const r: any = await fn({ text: target, model: getTaskModel('polish') });
    const polished: string | undefined = r.data?.text;
    if (!r.data?.success || typeof polished !== 'string' || !polished.trim()) {
      throw new Error(r.data?.reason || '整文に失敗しました');
    }
    // 待ち時間中に値が変わっていたら（フォーカス移動先での編集等）安全のため破棄
    if (el.value !== fullText) return;
    if (hasSelection) {
      setNativeValue(el, fullText.slice(0, selStart) + polished + fullText.slice(selEnd));
      el.setSelectionRange(selStart, selStart + polished.length);
    } else {
      setNativeValue(el, polished);
      el.setSelectionRange(polished.length, polished.length);
    }
  } finally {
    inflight = false;
    el.readOnly = false;
    el.style.opacity = prevOpacity;
    el.focus();
  }
}

/**
 * Alt+Shift+S 整文リスナーを取り付ける。戻り値は解除関数。
 * （Tauri 専用機能ではないため Web ビルドでも動作可）
 */
export function installTextPolish(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'KeyS' || !e.altKey || !e.shiftKey) return;
    if (e.ctrlKey || e.metaKey) return;
    if (e.repeat) return;
    if (!isTextPolishEnabled()) return;
    const el = asPolishableField(document.activeElement);
    if (!el) return;
    e.preventDefault();
    if (inflight) return; // 二重実行防止
    polishFocusedField(el).catch((err) => {
      console.warn('[textPolish] 整文に失敗:', err);
    });
  };

  window.addEventListener('keydown', onKeyDown, true);
  return () => {
    window.removeEventListener('keydown', onKeyDown, true);
  };
}
