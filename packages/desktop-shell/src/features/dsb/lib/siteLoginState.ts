/**
 * siteLoginState — 媒体サイトごとの「アプリ内ログイン」状態の記録（localStorage）。
 *
 * ログインは記事単位ではなくサイト単位の事象なので、ここで一元管理する:
 * - markSiteLoggedIn: ログイン完了（=ログイン用ウィンドウを閉じた）で epoch を進める。
 *   リーダーの本文キャッシュ(sblog-read:)は保存時の epoch を記録しており、
 *   epoch が変わると全記事がキャッシュミス扱い → 次に開いた時に新しい Cookie で
 *   自動的に取り直される（記事ごとの手動再取得は不要になる）。
 * - preferRaw: 旧CF（clientBlocks 未対応）環境での既定表示の記憶。true なら
 *   その媒体の英語記事は「ログイン本文（原文）」を既定表示にする。
 *   ログインした媒体は既定 true（ログインする＝ログイン本文が読みたい、が自然なため）。
 *   リーダーの切替ボタンの操作で上書きされる。
 */

const PREFIX = 'sblog-site-login:';

export interface SiteLoginState {
  epoch: number;      // 最終ログイン時刻（キャッシュ無効化の世代番号を兼ねる）
  preferRaw: boolean; // 英語記事で「ログイン本文（原文）」を既定表示するか
}

/** URL → サイトキー（www. は無視して同一サイト扱い）。 */
export function siteHostOf(url: string): string | null {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function getSiteLogin(url: string): SiteLoginState | null {
  const host = siteHostOf(url);
  if (!host) return null;
  try {
    const raw = localStorage.getItem(PREFIX + host);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return { epoch: Number(d.epoch) || 0, preferRaw: !!d.preferRaw };
  } catch {
    return null;
  }
}

/** キャッシュ世代の照合用。未ログインサイトは 0。 */
export function getSiteLoginEpoch(url: string): number {
  return getSiteLogin(url)?.epoch || 0;
}

/** ログイン完了を記録（epoch 更新＝この媒体の本文キャッシュを全無効化）。 */
export function markSiteLoggedIn(url: string): void {
  const host = siteHostOf(url);
  if (!host) return;
  const prev = getSiteLogin(url);
  try {
    localStorage.setItem(PREFIX + host, JSON.stringify({
      epoch: Date.now(),
      preferRaw: prev ? prev.preferRaw : true,
    }));
  } catch { /* noop */ }
}

/** 英語記事の既定表示（原文 or 翻訳）の記憶を更新。 */
export function setSitePreferRaw(url: string, preferRaw: boolean): void {
  const host = siteHostOf(url);
  if (!host) return;
  const prev = getSiteLogin(url);
  try {
    localStorage.setItem(PREFIX + host, JSON.stringify({
      epoch: prev?.epoch || 0,
      preferRaw,
    }));
  } catch { /* noop */ }
}
