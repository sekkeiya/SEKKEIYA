import { describe, it, expect } from 'vitest';
import {
  PROJECT_CONFIG_PATH, emptyProjectConfig, parseProjectConfig, serializeProjectConfig,
  normalizeVerify, validateVerifyCommand,
} from './projectConfig';

describe('PROJECT_CONFIG_PATH', () => {
  it('backlog.json と同じフォルダに置く', () => {
    expect(PROJECT_CONFIG_PATH).toBe('.claude/sekkeiya-code/project.json');
  });
});

describe('parseProjectConfig', () => {
  it('正常な JSON を読む', () => {
    const cfg = parseProjectConfig('{"version":1,"verify":[{"label":"型","command":"npx tsc --noEmit"}]}');
    expect(cfg.verify).toEqual([{ label: '型', command: 'npx tsc --noEmit' }]);
  });
  it('壊れた JSON でも落とさず空設定を返す', () => {
    expect(parseProjectConfig('{ broken')).toEqual(emptyProjectConfig());
    expect(parseProjectConfig('[]')).toEqual(emptyProjectConfig());
    expect(parseProjectConfig('null')).toEqual(emptyProjectConfig());
  });
  it('verify が配列でない・要素が壊れていても読める分だけ拾う', () => {
    expect(parseProjectConfig('{"verify":"nope"}').verify).toEqual([]);
    const cfg = parseProjectConfig('{"verify":[{"command":"npm test"},null,42,{"label":"x"}]}');
    expect(cfg.verify).toEqual([{ label: 'npm test', command: 'npm test' }]);
  });
});

describe('normalizeVerify', () => {
  it('空白を落とし、コマンド空の行は捨てる', () => {
    expect(normalizeVerify([
      { label: '  型  ', command: '  npx tsc  ' },
      { label: 'なし', command: '   ' },
    ])).toEqual([{ label: '型', command: 'npx tsc' }]);
  });
  it('ラベル未入力はコマンドで代用する', () => {
    expect(normalizeVerify([{ label: '', command: 'npm run lint' }]))
      .toEqual([{ label: 'npm run lint', command: 'npm run lint' }]);
  });
});

describe('serializeProjectConfig', () => {
  it('2スペース整形・末尾改行・キー順固定', () => {
    const s = serializeProjectConfig({ version: 1, verify: [{ label: 'L', command: 'C' }] });
    expect(s).toBe('{\n  "version": 1,\n  "verify": [\n    {\n      "label": "L",\n      "command": "C"\n    }\n  ]\n}\n');
  });
  it('往復して同じ内容になる', () => {
    const cfg = { version: 1 as const, verify: [{ label: 'a', command: 'npm test' }] };
    expect(parseProjectConfig(serializeProjectConfig(cfg))).toEqual(cfg);
  });
});

describe('validateVerifyCommand', () => {
  it('通常のコマンドは null', () => {
    expect(validateVerifyCommand('npm run build')).toBeNull();
  });
  it('空は弾く', () => {
    expect(validateVerifyCommand('')).toBe('コマンドを入力してください');
    expect(validateVerifyCommand('   ')).toBe('コマンドを入力してください');
  });
  it('改行と長すぎるコマンドを弾く', () => {
    expect(validateVerifyCommand('a\nb')).toContain('改行');
    expect(validateVerifyCommand('a'.repeat(301))).toContain('300文字');
  });
});
