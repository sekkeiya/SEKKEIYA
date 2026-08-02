import { describe, it, expect } from 'vitest';
import { initialScope, reconcileScope, groupProjectsForScope } from './researchScope';

describe('initialScope', () => {
  it('保存済みスコープを最優先する', () => {
    expect(initialScope('proj-a', 'proj-b')).toBe('proj-a');
  });
  it('保存が無ければ開いた時点のプロジェクトを使う', () => {
    expect(initialScope(null, 'proj-b')).toBe('proj-b');
  });
  it('どちらも無ければアカウントサイト', () => {
    expect(initialScope(null, null)).toBe('account');
  });
  it('空文字は未保存として扱う', () => {
    expect(initialScope('', 'proj-b')).toBe('proj-b');
  });
});

describe('reconcileScope', () => {
  it('アカウントサイトは常に有効', () => {
    expect(reconcileScope('account', [])).toBe('account');
  });
  it('存在するプロジェクトはそのまま', () => {
    expect(reconcileScope('proj-a', ['proj-a', 'proj-b'])).toBe('proj-a');
  });
  it('消えたプロジェクトはアカウントサイトへ退避する', () => {
    expect(reconcileScope('proj-x', ['proj-a'])).toBe('account');
  });
});

describe('groupProjectsForScope', () => {
  it('マイプロジェクトとチームプロジェクトに分ける', () => {
    const g = groupProjectsForScope([
      { id: 'p1', name: 'マイ1' },
      { id: 't1', name: 'チーム1', isTeam: true },
      { id: 'p2', name: 'マイ2', isTeam: false },
    ]);
    expect(g.my).toEqual([
      { id: 'p1', label: 'マイ1' },
      { id: 'p2', label: 'マイ2' },
    ]);
    expect(g.team).toEqual([{ id: 't1', label: 'チーム1' }]);
  });
  it('名前が空でも id で識別できるラベルを返す', () => {
    const g = groupProjectsForScope([{ id: 'p1', name: '' }]);
    expect(g.my).toEqual([{ id: 'p1', label: '(名称未設定)' }]);
  });
  it('空配列でも落ちない', () => {
    expect(groupProjectsForScope([])).toEqual({ my: [], team: [] });
  });
});
