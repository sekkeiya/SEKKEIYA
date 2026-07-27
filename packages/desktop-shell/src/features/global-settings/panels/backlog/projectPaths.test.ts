import { describe, it, expect } from 'vitest';
import { DEV_PROJECTS_SUBDIR, validateProjectName, buildDevProjectPath } from './projectPaths';

describe('validateProjectName', () => {
  it('通常の名前は null（エラー無し）', () => {
    expect(validateProjectName('my-plugin')).toBeNull();
    expect(validateProjectName('日本語の名前')).toBeNull();
    expect(validateProjectName('  trimmed  ')).toBeNull();
  });
  it('空・空白のみは弾く', () => {
    expect(validateProjectName('')).toBe('プロジェクト名を入力してください');
    expect(validateProjectName('   ')).toBe('プロジェクト名を入力してください');
  });
  it('パス区切りや禁止文字を弾く（ディレクトリ脱出の防止）', () => {
    expect(validateProjectName('a/b')).toContain('使用できない文字');
    expect(validateProjectName('a\\b')).toContain('使用できない文字');
    expect(validateProjectName('C:')).toContain('使用できない文字');
    expect(validateProjectName('a?b')).toContain('使用できない文字');
  });
  it('. と .. を弾く', () => {
    expect(validateProjectName('.')).toBe('その名前は使用できません');
    expect(validateProjectName('..')).toBe('その名前は使用できません');
  });
  it('Windows で不正な末尾（. / 空白）を弾く', () => {
    expect(validateProjectName('name.')).toContain('末尾');
    expect(validateProjectName('name ')).toBeNull(); // trim されるので OK
  });
  it('Windows 予約語を弾く（大小文字を問わない）', () => {
    expect(validateProjectName('CON')).toContain('予約語');
    expect(validateProjectName('com1')).toContain('予約語');
    expect(validateProjectName('console')).toBeNull(); // 前方一致では弾かない
  });
  it('長すぎる名前を弾く', () => {
    expect(validateProjectName('a'.repeat(65))).toContain('64文字');
    expect(validateProjectName('a'.repeat(64))).toBeNull();
  });
});

describe('buildDevProjectPath', () => {
  it('SEKKEIYA/Dev 配下の絶対パスを組み立てる', () => {
    expect(buildDevProjectPath('C:/Users/me', 'app')).toBe('C:/Users/me/SEKKEIYA/Dev/app');
  });
  it('Windows のバックスラッシュを / に正規化する', () => {
    expect(buildDevProjectPath('C:\\Users\\me', 'app')).toBe('C:/Users/me/SEKKEIYA/Dev/app');
  });
  it('ホームの末尾区切りを吸収し、名前は trim する', () => {
    expect(buildDevProjectPath('C:/Users/me/', '  app  ')).toBe('C:/Users/me/SEKKEIYA/Dev/app');
    expect(buildDevProjectPath('C:/Users/me\\', 'app')).toBe('C:/Users/me/SEKKEIYA/Dev/app');
  });
  it('サブディレクトリ定数と一致する', () => {
    expect(DEV_PROJECTS_SUBDIR).toBe('SEKKEIYA/Dev');
    expect(buildDevProjectPath('/home/u', 'x')).toContain(`/${DEV_PROJECTS_SUBDIR}/`);
  });
});
