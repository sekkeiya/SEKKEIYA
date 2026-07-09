/**
 * プロジェクトに対する現在ユーザーの権限を解決するフック（docs/15 §4）。
 * roles が未設定の旧 Pj は ownerId/memberIds にフォールバックする（deriveRoles）。
 *
 * 子アプリ側で編集 UI の活性/非活性を切り替える際にも再利用する。
 */

import { useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import type { DesktopProject, ProjectRole } from './types';
import { deriveRoles, roleOf, canEdit as canEditFn, canManage as canManageFn } from './roles';

export interface ProjectPermission {
  role: ProjectRole | null;
  isMember: boolean;
  canEdit: boolean;    // owner / editor（viewer は false）
  canManage: boolean;  // owner のみ（設定・削除・公開・メンバー管理）
  isViewer: boolean;
}

export function resolveProjectPermission(
  project: Pick<DesktopProject, 'roles' | 'ownerId' | 'memberIds'> | null | undefined,
  uid: string | null | undefined,
): ProjectPermission {
  const roles = deriveRoles({
    roles: project?.roles,
    ownerId: project?.ownerId,
    memberIds: project?.memberIds,
  });
  const role = roleOf(roles, uid);
  return {
    role,
    isMember: role != null,
    canEdit: canEditFn(roles, uid),
    canManage: canManageFn(roles, uid),
    isViewer: role === 'viewer',
  };
}

export function useProjectPermission(
  project: Pick<DesktopProject, 'roles' | 'ownerId' | 'memberIds'> | null | undefined,
): ProjectPermission {
  const uid = useAuthStore(s => s.currentUser?.uid) || '';
  return useMemo(() => resolveProjectPermission(project, uid), [project, uid]);
}
