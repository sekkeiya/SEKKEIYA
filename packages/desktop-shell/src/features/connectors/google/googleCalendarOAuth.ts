// Google Calendar OAuth 2.0 フロー（デスクトップアプリ用ループバック方式）。
// Google の「インストール済みアプリ」OAuth:
//   client_secret をアプリに埋め込むのは Google が公式に承認している方式。
//   参照: https://developers.google.com/identity/protocols/oauth2/native-app
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { ConnectorToken } from '../types';

// ── Credentials（デスクトップアプリ用 OAuth 設定） ──────────────────────────────
// インストール済みアプリの client_secret は Google 上「機密ではない」扱いだが、
// ソース管理に平文で残さないため build 時に env（.env）から注入する。
// Login.tsx と同じ VITE_GOOGLE_* を使用。設定例は .env.example を参照。
const GOOGLE_CLIENT_ID     = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI         = import.meta.env.VITE_GOOGLE_REDIRECT_URI ?? 'http://127.0.0.1:14205';

function assertGoogleCredentials(): void {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'Google OAuth 未設定: VITE_GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_SECRET を .env に設定してください（.env.example 参照）',
    );
  }
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
].join(' ');

// ── OAuth 認可コード → トークン交換 ─────────────────────────────────────────
async function exchangeCode(code: string): Promise<ConnectorToken> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token exchange failed: ${data.error_description ?? data.error}`);
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Date.now() + data.expires_in * 1000,
    scope:        data.scope ?? SCOPES,
  };
}

// ── メインの OAuth フロー ────────────────────────────────────────────────────
export async function connectGoogleCalendar(): Promise<ConnectorToken & { email?: string }> {
  assertGoogleCredentials();
  // 1. Rust 側でポート 14205 にループバック HTTP サーバーを起動（非同期で待機）
  const callbackPromise = invoke<string>('perform_oauth_loopback');

  // 2. Google 認可 URL を組み立てて OS ブラウザで開く
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id',     GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri',  REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope',         SCOPES);
  authUrl.searchParams.set('access_type',   'offline');
  authUrl.searchParams.set('prompt',        'consent');  // 毎回 refresh_token を取得

  await openUrl(authUrl.toString());

  // 3. ユーザーが認可するとブラウザが 127.0.0.1:14205 にリダイレクト
  //    Rust が GET /?code=... を受け取り query string を返す
  const callbackQuery = await callbackPromise;  // "/?code=xxx&scope=..."
  const params = new URLSearchParams(callbackQuery.replace(/^\/?/, ''));
  const code   = params.get('code');
  if (!code) throw new Error('Google からの認証コードが受け取れませんでした');

  // 4. コード → トークン交換
  const token = await exchangeCode(code);

  // 5. id_token からメールアドレスを取得（オプション）
  let email: string | undefined;
  try {
    const parts = token.accessToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      email = payload.email;
    }
  } catch { /* ignore */ }

  // id_token 経由が失敗した場合は userinfo エンドポイントで取得
  if (!email) {
    try {
      const ui = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      const uiData = await ui.json();
      email = uiData.email;
    } catch { /* ignore */ }
  }

  return { ...token, email };
}

// ── トークンリフレッシュ ─────────────────────────────────────────────────────
export async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  assertGoogleCredentials();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token:  refreshToken,
      client_id:      GOOGLE_CLIENT_ID,
      client_secret:  GOOGLE_CLIENT_SECRET,
      grant_type:     'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description ?? data.error}`);
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}
