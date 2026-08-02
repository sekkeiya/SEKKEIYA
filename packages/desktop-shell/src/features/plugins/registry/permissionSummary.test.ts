import { describe, it, expect } from 'vitest';
import { describePermissions, hasSensitivePermissions } from './permissionSummary';

describe('describePermissions', () => {
  it('宣言なしは空配列', () => {
    expect(describePermissions(undefined)).toEqual([]);
    expect(describePermissions({})).toEqual([]);
  });
  it('全部宣言すると 4 行になる', () => {
    const lines = describePermissions({
      workFiles: 'readwrite',
      readScopes: ['3dss'],
      network: ['https://api.example.com'],
      chat: true,
    });
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('読み書き');
    expect(lines[1]).toContain('3dss');
    expect(lines[2]).toContain('https://api.example.com');
    expect(lines[3]).toContain('Chat');
  });
  it('read と readwrite で文言を変える', () => {
    expect(describePermissions({ workFiles: 'read' })[0]).toContain('読み取る');
    expect(describePermissions({ workFiles: 'readwrite' })[0]).toContain('読み書き');
  });
});

describe('hasSensitivePermissions', () => {
  it('network か chat があれば true', () => {
    expect(hasSensitivePermissions({ network: ['https://a.example'] })).toBe(true);
    expect(hasSensitivePermissions({ chat: true })).toBe(true);
  });
  it('workFiles だけなら false（外に出ない）', () => {
    expect(hasSensitivePermissions({ workFiles: 'readwrite' })).toBe(false);
    expect(hasSensitivePermissions(undefined)).toBe(false);
  });
});
