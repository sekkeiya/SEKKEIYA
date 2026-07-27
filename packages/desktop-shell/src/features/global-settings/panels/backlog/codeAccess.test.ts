import { describe, it, expect } from 'vitest';
import { resolveCodeAccess, initialProjectRef } from './codeAccess';

describe('resolveCodeAccess', () => {
  it('管理者 × デスクトップ: クラウドもローカルも使える（従来どおり）', () => {
    expect(resolveCodeAccess({ isAdmin: true, isDesktop: true })).toEqual({ enabled: true, cloud: true, local: true });
  });
  it('管理者 × Web: クラウドのみ（ローカルは fs が無い）', () => {
    expect(resolveCodeAccess({ isAdmin: true, isDesktop: false })).toEqual({ enabled: true, cloud: true, local: false });
  });
  it('一般ユーザー × デスクトップ: ローカルのみ（クラウドは隠す）', () => {
    expect(resolveCodeAccess({ isAdmin: false, isDesktop: true })).toEqual({ enabled: true, cloud: false, local: true });
  });
  it('一般ユーザー × Web: 機能ごと無効（開いても何もできないため）', () => {
    expect(resolveCodeAccess({ isAdmin: false, isDesktop: false })).toEqual({ enabled: false, cloud: false, local: false });
  });
});

describe('initialProjectRef', () => {
  const admin = resolveCodeAccess({ isAdmin: true, isDesktop: true });
  const user = resolveCodeAccess({ isAdmin: false, isDesktop: true });
  const web = resolveCodeAccess({ isAdmin: false, isDesktop: false });

  it('クラウドが使えるならクラウドを既定にする（登録済みローカルがあっても）', () => {
    expect(initialProjectRef(admin, ['C:/p/a'])).toEqual({ kind: 'cloud' });
    expect(initialProjectRef(admin, [])).toEqual({ kind: 'cloud' });
  });
  it('一般ユーザーは登録済みローカルの先頭を既定にする', () => {
    expect(initialProjectRef(user, ['C:/p/a', 'C:/p/b'])).toEqual({ kind: 'local', path: 'C:/p/a' });
  });
  it('一般ユーザーでローカルが未登録なら null（＝作成を促す空状態）', () => {
    expect(initialProjectRef(user, [])).toBeNull();
  });
  it('無効なら常に null', () => {
    expect(initialProjectRef(web, ['C:/p/a'])).toBeNull();
  });
});
