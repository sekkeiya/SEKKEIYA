import { describe, it, expect } from 'vitest';
import {
  emptyBacklogFile, parseBacklogFile, serializeBacklogFile,
  addEntry, patchEntry, removeEntry, isSelfWrite,
} from './localBacklogLogic';

describe('emptyBacklogFile / parseBacklogFile', () => {
  it('空ファイルは version 1 / 指定 projectKey / 空配列', () => {
    const f = emptyBacklogFile('my-app');
    expect(f).toEqual({ version: 1, projectKey: 'my-app', items: [], sprints: [] });
  });
  it('serialize→parse がラウンドトリップする', () => {
    const f = emptyBacklogFile('p');
    expect(parseBacklogFile(serializeBacklogFile(f))).toEqual(f);
  });
  it('欠けたフィールドは既定値で補完される', () => {
    const f = parseBacklogFile('{"projectKey":"x"}');
    expect(f.version).toBe(1);
    expect(f.items).toEqual([]);
    expect(f.sprints).toEqual([]);
  });
  it('不正 JSON / 非オブジェクトは throw', () => {
    expect(() => parseBacklogFile('not json')).toThrow();
    expect(() => parseBacklogFile('[1,2]')).toThrow();
    expect(() => parseBacklogFile('null')).toThrow();
  });
});

describe('serializeBacklogFile', () => {
  it('2スペース整形・末尾改行・キー順が安定（id が先頭）', () => {
    const f = emptyBacklogFile('p');
    f.items.push({ text: 'あ', id: 'i1', type: 'requirement', seq: 1 } as never);
    const s = serializeBacklogFile(f);
    expect(s.endsWith('\n')).toBe(true);
    expect(s).toContain('  "version": 1');
    const item = s.slice(s.indexOf('"items"'));
    expect(item.indexOf('"id"')).toBeLessThan(item.indexOf('"text"')); // 優先キーが先
  });
  it('キー挿入順が違っても同一出力（安定直列化）', () => {
    const a = { ...emptyBacklogFile('p'), items: [{ id: 'i', seq: 1, type: 'request', text: 't' } as never] };
    const b = { ...emptyBacklogFile('p'), items: [{ text: 't', type: 'request', seq: 1, id: 'i' } as never] };
    expect(serializeBacklogFile(a)).toBe(serializeBacklogFile(b));
  });
});

describe('addEntry / patchEntry / removeEntry', () => {
  const base = [{ id: 'a', text: 'A', status: 'todo' } as Record<string, unknown> & { id: string }];
  it('addEntry は id と createdAt/updatedAt を付与し末尾に追加（元配列は不変）', () => {
    const out = addEntry(base, { text: 'B' }, 'b', '2026-07-26T00:00:00.000Z');
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ id: 'b', text: 'B', createdAt: '2026-07-26T00:00:00.000Z', updatedAt: '2026-07-26T00:00:00.000Z' });
    expect(base).toHaveLength(1);
  });
  it('patchEntry はマージし updatedAt を更新（元配列・元要素は不変）', () => {
    const out = patchEntry(base, 'a', { status: 'done' }, '2026-07-26T01:00:00.000Z');
    expect(out[0]).toMatchObject({ id: 'a', text: 'A', status: 'done', updatedAt: '2026-07-26T01:00:00.000Z' });
    expect(base[0].status).toBe('todo');
  });
  it('patchEntry: 不在 id は throw', () => {
    expect(() => patchEntry(base, 'zzz', {}, 'now')).toThrow(/zzz/);
  });
  it('removeEntry は該当のみ除去', () => {
    expect(removeEntry(base, 'a')).toEqual([]);
    expect(removeEntry(base, 'zzz')).toEqual(base);
  });
});

describe('isSelfWrite', () => {
  it('直前に書いた内容と一致なら true、null や不一致は false', () => {
    expect(isSelfWrite('abc', 'abc')).toBe(true);
    expect(isSelfWrite('abc', 'abd')).toBe(false);
    expect(isSelfWrite(null, 'abc')).toBe(false);
  });
});
