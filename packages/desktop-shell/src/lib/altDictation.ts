// altDictation.ts — Alt+S で Windows 音声入力（Win+H ディクテーション）を起動する。
//
// Windows 標準の音声入力（Win+H）と同じ体験をアプリ内ショートカットとして提供する。
// Alt+S を押すと Rust 側コマンド open_windows_dictation が Win+H を送出して
// OS のディクテーションパネルを開く。認識テキストは OS がフォーカス中の
// テキスト欄へ直接入力するため、チャット欄に限らずアプリ内のあらゆる入力欄で使える。
// もう一度 Alt+S（または Win+H）でパネルは閉じる（OS のトグル挙動）。
//
// 送信フロー: 音声入力中に Alt 単押しで OS が認識テキストを確定する。
// その「確定直後」だけ Space を Enter に変換してフォーカス中の入力欄へ送るため、
// Space / Enter どちらでもそのままチャット送信できる（Enter は元々送信キー）。
// Space はワンショット変換で、他のキー入力・クリック・タイムアウトで即解除される。
//
// パネルの自動クローズ: Windows のディクテーションパネルは無音になっても
// 画面に残り続けて邪魔になる。そこで「話し終えて Alt で確定した瞬間」に
// もう一度 Win+H（同じトグルコマンド）を送ってパネルを閉じる。送信キーを
// 持たないメモ欄などでもパネルが確実に消えるよう、送信時ではなく確定時に閉じる。
//
// 注意: スクリーンショットのグローバルショートカットは Ctrl+Alt+S。
// Ctrl / Shift / Meta 併用時は発動しないようガードして競合を避けている。

import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './platform';

/* ─────────── 有効/無効設定（Global Settings > 音声）: localStorage永続 ─────────── */
const ALT_DICTATION_KEY = 'sekkeiya-alt-dictation-enabled';

/** Alt+S 音声入力ショートカットが有効か（既定: 有効）。 */
export function isAltDictationEnabled(): boolean {
  try { return localStorage.getItem(ALT_DICTATION_KEY) !== '0'; } catch { return true; }
}

/** Alt+S 音声入力ショートカットの有効/無効を切り替える（即時反映・再起動不要）。 */
export function setAltDictationEnabled(on: boolean): void {
  try { localStorage.setItem(ALT_DICTATION_KEY, on ? '1' : '0'); } catch { /* noop */ }
}

/* ─────────── 状態遷移: idle → dictating → armed(Alt確定直後) → idle ───────────
 * dictating: Alt+S でディクテーション起動中（パネル表示中）。
 * armed    : 音声入力中に Alt 単押しで確定した直後。パネルは既に閉じており、
 *            この間だけ Space を Enter に変換して入力欄の送信ハンドラを発火させる。
 *            誤爆防止のため、他のキー・ポインタ操作・タイムアウトで即 idle に戻す。 */
type DictationPhase = 'idle' | 'dictating' | 'armed';

/** Alt確定後、Space送信を受け付ける猶予（ms）。過ぎたら通常のSpaceに戻る。 */
const ARMED_TIMEOUT_MS = 15_000;

/**
 * フォーカス中の要素へ合成 Enter keydown を送る。
 * React はルートでネイティブイベントを購読しているため、バブリングさせれば
 * チャット欄の onKeyDown（Enter=送信）がそのまま発火する。合成イベントは
 * ブラウザ既定動作（textarea の改行など）を起こさないので副作用もない。
 */
function dispatchEnterToActiveElement(): void {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return;
  el.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', bubbles: true, cancelable: true,
  }));
}

/**
 * Win+H を送出してディクテーションパネルをトグルする（開く＝閉じるの両用）。
 * Rust 側 open_windows_dictation は純粋なトグルなので、開いている状態で
 * 呼べば閉じ、閉じている状態で呼べば開く。呼び出し回数の偶奇でパネルの
 * 開閉が決まるため、開いたら必ず1回だけ閉じるよう状態機械側で釣り合わせる。
 */
function toggleDictationPanel(): void {
  invoke('open_windows_dictation').catch((err) => {
    console.warn('[altDictation] Windows音声入力のトグルに失敗:', err);
  });
}

/**
 * Alt+S リスナーを取り付ける。戻り値は解除関数。
 * Web ビルド（Tauri 外）では何もしない。
 */
export function installAltDictation(): () => void {
  if (!isTauri()) return () => {};

  let phase: DictationPhase = 'idle';
  let armedTimer: ReturnType<typeof setTimeout> | null = null;

  const setPhase = (next: DictationPhase) => {
    if (armedTimer !== null) { clearTimeout(armedTimer); armedTimer = null; }
    phase = next;
    if (next === 'armed') {
      armedTimer = setTimeout(() => { armedTimer = null; phase = 'idle'; }, ARMED_TIMEOUT_MS);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isAltDictationEnabled()) return; // 設定で無効化中（毎回参照するのでトグルが即反映される）

    // Alt+S: ディクテーションのトグル起動/終了
    if (e.code === 'KeyS' && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
      if (e.repeat) return;
      e.preventDefault();
      // dictating 中なら手動停止＝閉じる。idle/armed からは起動＝開く。
      // （armed のときパネルは既に閉じているので、ここでの1回で開く側に釣り合う）
      setPhase(phase === 'dictating' ? 'idle' : 'dictating');
      toggleDictationPanel();
      return;
    }

    // 音声入力中の Alt 単押し = OS が認識テキストを確定。
    // 確定と同時にパネルを閉じ（もう邪魔にならない）、Space送信を受付開始する。
    if (phase === 'dictating' && e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
      if (e.repeat) return;
      setPhase('armed');
      toggleDictationPanel(); // 開いていたパネルを1回で閉じる（釣り合い）
      return;
    }

    if (phase !== 'armed') return;

    // Alt確定直後: Space は送信（Enterに変換）、Enter は通常どおり送信されるので素通し
    if (e.code === 'Space' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      e.preventDefault(); // スペース文字の挿入を止める
      setPhase('idle');   // ワンショット（先に戻して合成Enterの再入を防ぐ）
      dispatchEnterToActiveElement();
      return;
    }
    if (e.key === 'Enter') { setPhase('idle'); return; }

    // それ以外のキー入力は「続けて編集する」意思なので送信待ちを解除
    if (e.key !== 'Alt') setPhase('idle');
  };

  // クリック等の操作でも送信待ちを解除（誤送信防止）
  const onPointerDown = () => { if (phase === 'armed') setPhase('idle'); };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
    if (armedTimer !== null) clearTimeout(armedTimer);
  };
}
