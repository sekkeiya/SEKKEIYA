/**
 * プロジェクト / チームのロール権限ヘルパ（docs/15）。
 *
 * 設計上の不変条件:
 *   - `roles` (uid → role) が正（source of truth）。
 *   - `memberIds` は常に Object.keys(roles) と一致させる（Firestore ルールの
 *     `in` 演算は配列にしか効かないため、高速判定用インデックスとして残す）。
 *   - 各 Pj は最低 1 名の owner を持つ。
 *
 * すべて副作用のない純粋関数。Firestore への書き込みは API 側（promote/transfer 等）が行う。
 */

import type { ProjectRole, RoleMap } from './types';

export const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'オーナー',
  editor: '編集者',
  viewer: '閲覧者',
};

/** UI セレクタ等で使う表示順。 */
export const ROLE_ORDER: ProjectRole[] = ['owner', 'editor', 'viewer'];

/** roles が未設定の旧 Pj 向けフォールバック。ownerId を owner、その他 memberIds を editor とみなす。 */
export function deriveRoles(params: {
  roles?: RoleMap | null;
  ownerId?: string | null;
  memberIds?: string[] | null;
}): RoleMap {
  if (params.roles && Object.keys(params.roles).length > 0) return params.roles;
  const derived: RoleMap = {};
  for (const uid of params.memberIds ?? []) derived[uid] = 'editor';
  if (params.ownerId) derived[params.ownerId] = 'owner';
  return derived;
}

/** 指定ユーザーのロールを返す（未所属なら null）。 */
export function roleOf(roles: RoleMap | null | undefined, uid: string | null | undefined): ProjectRole | null {
  if (!roles || !uid) return null;
  return roles[uid] ?? null;
}

export function isOwner(roles: RoleMap | null | undefined, uid: string | null | undefined): boolean {
  return roleOf(roles, uid) === 'owner';
}

/** owner / editor は編集可能。 */
export function canEdit(roles: RoleMap | null | undefined, uid: string | null | undefined): boolean {
  const r = roleOf(roles, uid);
  return r === 'owner' || r === 'editor';
}

/** 設定・削除・公開・メンバー管理は owner のみ。 */
export function canManage(roles: RoleMap | null | undefined, uid: string | null | undefined): boolean {
  return isOwner(roles, uid);
}

export function isMember(roles: RoleMap | null | undefined, uid: string | null | undefined): boolean {
  return roleOf(roles, uid) != null;
}

export function ownerUids(roles: RoleMap | null | undefined): string[] {
  if (!roles) return [];
  return Object.keys(roles).filter(uid => roles[uid] === 'owner');
}

/** roles から派生する memberIds（= キー一覧）。書き込み前に必ずこれで同期する。 */
export function memberIdsFromRoles(roles: RoleMap): string[] {
  return Object.keys(roles);
}

/**
 * roles を更新した payload に、同期済みの memberIds を必ず添える。
 * Firestore への set/update 時に `...withMemberSync(nextRoles)` の形で使う。
 */
export function withMemberSync(roles: RoleMap): { roles: RoleMap; memberIds: string[] } {
  return { roles, memberIds: memberIdsFromRoles(roles) };
}

/** 「最低 1 owner」を侵す変更を弾く。違反時は Error を投げる（呼び出し側で書き込み前に検証）。 */
export function ensureAtLeastOneOwner(roles: RoleMap): void {
  if (ownerUids(roles).length === 0) {
    throw new Error('プロジェクトには最低 1 名のオーナーが必要です。');
  }
}

/**
 * owner 権限の譲渡を計算する（純粋）。新 owner を owner に、旧 owner を editor に降格する。
 * 「最後の owner を失う」ケースは ensureAtLeastOneOwner により安全に保たれる。
 */
export function applyOwnershipTransfer(roles: RoleMap, fromUid: string, toUid: string): RoleMap {
  const next: RoleMap = { ...roles };
  next[toUid] = 'owner';
  if (fromUid !== toUid && next[fromUid] === 'owner') next[fromUid] = 'editor';
  ensureAtLeastOneOwner(next);
  return next;
}

/** ロール変更を計算する（純粋）。owner を非 owner に落とす場合は最低 1 owner を保証。 */
export function applyRoleChange(roles: RoleMap, uid: string, role: ProjectRole): RoleMap {
  const next: RoleMap = { ...roles, [uid]: role };
  ensureAtLeastOneOwner(next);
  return next;
}

/** メンバー除外を計算する（純粋）。最後の owner は除外不可。 */
export function applyMemberRemoval(roles: RoleMap, uid: string): RoleMap {
  const next: RoleMap = { ...roles };
  delete next[uid];
  ensureAtLeastOneOwner(next);
  return next;
}
