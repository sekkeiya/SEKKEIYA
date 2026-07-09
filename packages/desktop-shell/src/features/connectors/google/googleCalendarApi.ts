// Google Calendar REST API クライアント。
// すべての関数はアクセストークンを受け取り直接 Google API を呼ぶ。
// デスクトップアプリなので CORS 制限はない。

const BASE = 'https://www.googleapis.com/calendar/v3';

async function gcalFetch(path: string, accessToken: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return { ok: true };
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Google Calendar API error ${res.status}`);
  }
  return data;
}

// ── カレンダー一覧 ────────────────────────────────────────────────────────────
export async function listCalendars(accessToken: string) {
  return gcalFetch('/users/me/calendarList', accessToken);
}

// ── イベント一覧 ──────────────────────────────────────────────────────────────
export interface ListEventsParams {
  calendarId?: string;
  timeMin?:    string;  // ISO 8601
  timeMax?:    string;
  q?:          string;  // テキスト検索
  maxResults?: number;
  orderBy?:    'startTime' | 'updated';
}

export async function listEvents(accessToken: string, params: ListEventsParams = {}) {
  const calId = encodeURIComponent(params.calendarId ?? 'primary');
  const qs = new URLSearchParams();
  if (params.timeMin)    qs.set('timeMin',    params.timeMin);
  if (params.timeMax)    qs.set('timeMax',    params.timeMax);
  if (params.q)          qs.set('q',          params.q);
  qs.set('maxResults',   String(params.maxResults ?? 50));
  qs.set('orderBy',      params.orderBy ?? 'startTime');
  qs.set('singleEvents', 'true');
  return gcalFetch(`/calendars/${calId}/events?${qs}`, accessToken);
}

// ── イベント作成 ──────────────────────────────────────────────────────────────
export interface CreateEventParams {
  calendarId?:  string;
  summary:      string;
  description?: string;
  start:        { dateTime?: string; date?: string; timeZone?: string };
  end:          { dateTime?: string; date?: string; timeZone?: string };
  colorId?:     string;  // 1-11
  location?:    string;
  reminders?:   { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
}

export async function createEvent(accessToken: string, params: CreateEventParams) {
  const calId = encodeURIComponent(params.calendarId ?? 'primary');
  const { calendarId: _cid, ...body } = params;
  return gcalFetch(`/calendars/${calId}/events`, accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── イベント更新 ──────────────────────────────────────────────────────────────
export interface UpdateEventParams {
  calendarId?: string;
  eventId:     string;
  summary?:    string;
  description?: string;
  start?:      { dateTime?: string; date?: string; timeZone?: string };
  end?:        { dateTime?: string; date?: string; timeZone?: string };
  colorId?:    string;
  location?:   string;
}

export async function updateEvent(accessToken: string, params: UpdateEventParams) {
  const calId   = encodeURIComponent(params.calendarId ?? 'primary');
  const eventId = encodeURIComponent(params.eventId);
  const { calendarId: _cid, eventId: _eid, ...patch } = params;
  return gcalFetch(`/calendars/${calId}/events/${eventId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// ── イベント削除 ──────────────────────────────────────────────────────────────
export async function deleteEvent(accessToken: string, calendarId: string = 'primary', eventId: string) {
  const calId = encodeURIComponent(calendarId);
  const evId  = encodeURIComponent(eventId);
  return gcalFetch(`/calendars/${calId}/events/${evId}`, accessToken, { method: 'DELETE' });
}
