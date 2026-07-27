import { describe, it, expect } from 'vitest';
import { validateRemoteUrl, DEFAULT_BRANCH, notARepoMessage } from './gitSetup';

describe('validateRemoteUrl', () => {
  it('https の GitHub URL を受け付ける', () => {
    expect(validateRemoteUrl('https://github.com/owner/repo.git')).toBeNull();
    expect(validateRemoteUrl('https://github.com/owner/repo')).toBeNull();
    expect(validateRemoteUrl('  https://example.com/a/b.git  ')).toBeNull();
  });
  it('SSH 形式を受け付ける', () => {
    expect(validateRemoteUrl('git@github.com:owner/repo.git')).toBeNull();
    expect(validateRemoteUrl('ssh://git@github.com/owner/repo.git')).toBeNull();
  });
  it('空は弾く', () => {
    expect(validateRemoteUrl('')).toBe('リモート URL を入力してください');
    expect(validateRemoteUrl('   ')).toBe('リモート URL を入力してください');
  });
  it('空白入り・形式不正を弾く', () => {
    expect(validateRemoteUrl('https://github.com/owner/re po')).toContain('空白');
    expect(validateRemoteUrl('github.com/owner/repo')).toContain('形式');
    expect(validateRemoteUrl('https://github.com')).toContain('形式');
    expect(validateRemoteUrl('not a url')).toContain('空白');
  });
  it('長すぎる URL を弾く', () => {
    expect(validateRemoteUrl('https://a.com/' + 'x'.repeat(500))).toContain('長すぎ');
  });
});

describe('DEFAULT_BRANCH', () => {
  it('main を既定にする', () => {
    expect(DEFAULT_BRANCH).toBe('main');
  });
});

describe('notARepoMessage', () => {
  it('パスを含めて伝える', () => {
    expect(notARepoMessage('C:/p/a')).toContain('C:/p/a');
  });
});
