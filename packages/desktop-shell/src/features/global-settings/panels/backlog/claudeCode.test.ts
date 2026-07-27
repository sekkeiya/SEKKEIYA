import { describe, it, expect } from 'vitest';
import { parseClaudeVersion, statusLabel, installGuidance, type ClaudeCodeStatus } from './claudeCode';

const ok = (version: string | null): ClaudeCodeStatus => ({ installed: true, version, path: 'C:/x/claude.cmd', error: null });
const ng = (error: string | null): ClaudeCodeStatus => ({ installed: false, version: null, path: null, error });

describe('parseClaudeVersion', () => {
  it('"1.0.30 (Claude Code)" 形式から取り出す', () => {
    expect(parseClaudeVersion('1.0.30 (Claude Code)')).toBe('1.0.30');
  });
  it('前置きや改行があっても取り出す', () => {
    expect(parseClaudeVersion('\nclaude 1.2.3\n')).toBe('1.2.3');
  });
  it('プレリリース付きも取り出す', () => {
    expect(parseClaudeVersion('2.0.0-beta.1 (Claude Code)')).toBe('2.0.0-beta.1');
  });
  it('バージョンが無ければ null', () => {
    expect(parseClaudeVersion('command not found')).toBeNull();
    expect(parseClaudeVersion('')).toBeNull();
  });
});

describe('statusLabel', () => {
  it('未取得は確認中', () => {
    expect(statusLabel(null)).toContain('確認中');
  });
  it('導入済みはバージョンを出す', () => {
    expect(statusLabel(ok('1.0.30'))).toBe('Claude Code: v1.0.30');
  });
  it('バージョン不明でも導入済みと分かる', () => {
    expect(statusLabel(ok(null))).toBe('Claude Code: 導入済み');
  });
  it('未導入と分かる', () => {
    expect(statusLabel(ng(null))).toBe('Claude Code: 未導入');
  });
});

describe('installGuidance', () => {
  it('導入済みなら案内を出さない', () => {
    expect(installGuidance(ok('1.0.0'))).toBe('');
  });
  it('未導入なら理由つきで案内する', () => {
    expect(installGuidance(ng('PATH に見つかりません'))).toContain('PATH に見つかりません');
    expect(installGuidance(ng(null))).toContain('見つかりませんでした');
  });
});
