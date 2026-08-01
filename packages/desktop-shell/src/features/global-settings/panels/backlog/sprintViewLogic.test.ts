// sprintViewLogic の純ロジックテスト（fs / React 非依存）。
import { describe, it, expect } from 'vitest';
import { filterItemsBySprint, snapshotDocId, archivedSprintsDesc, filterBacklogItems, allSprintsDesc } from './sprintViewLogic';
import type { BacklogItem, Sprint } from '../DevStatusPanel';

const req = (id: string, sprintId: string | null, requestId?: string): BacklogItem =>
  ({ id, type: 'requirement', seq: 1, title: id, sprintId, requestId } as unknown as BacklogItem);
const request = (id: string): BacklogItem =>
  ({ id, type: 'request', seq: 1, title: id } as unknown as BacklogItem);
const s = (id: string, seq: number, archived?: boolean): Sprint =>
  ({ id, seq, startDate: '2026-01-01', endDate: '2026-01-14', archived } as Sprint);

describe('filterItemsBySprint', () => {
  const items = [
    request('rq1'), request('rq2'),
    req('a', 's1', 'rq1'), req('b', 's1'), req('c', 's2', 'rq2'), req('d', null, 'rq1'),
  ];
  it('該当スプリントの要件と、その親要求だけを返す', () => {
    const out = filterItemsBySprint(items, 's1');
    expect(out.map(i => i.id).sort()).toEqual(['a', 'b', 'rq1']);
  });
  it('親要求は重複しない・無関係な要求は含まない', () => {
    const out = filterItemsBySprint([...items, req('e', 's1', 'rq1')], 's1');
    expect(out.filter(i => i.id === 'rq1')).toHaveLength(1);
    expect(out.some(i => i.id === 'rq2')).toBe(false);
  });
  it('該当なしなら空配列', () => {
    expect(filterItemsBySprint(items, 'nope')).toEqual([]);
  });
});

describe('snapshotDocId', () => {
  it('sprintId と type をアンダースコアで結合する', () => {
    expect(snapshotDocId('abc', 'er')).toBe('abc_er');
  });
});

describe('archivedSprintsDesc', () => {
  it('アーカイブ済みだけを seq 降順で返す', () => {
    const out = archivedSprintsDesc([s('x', 1, true), s('y', 3, true), s('z', 2), s('w', 4, false)]);
    expect(out.map(v => v.id)).toEqual(['y', 'x']);
  });
});

describe('filterBacklogItems', () => {
  const items = [
    request('rq1'), request('rq2'), request('rqEmpty'),
    req('a', null, 'rq1'), req('b', 's1', 'rq2'), req('c', null),
  ];
  it('未割当の要件＋その親要求＋要件ゼロの要求を返す', () => {
    const out = filterBacklogItems(items);
    expect(out.map(i => i.id).sort()).toEqual(['a', 'c', 'rq1', 'rqEmpty']);
  });
  it('全要件が割当済みの要求は含まない', () => {
    expect(filterBacklogItems(items).some(i => i.id === 'rq2')).toBe(false);
  });
});

describe('allSprintsDesc', () => {
  it('アクティブ・アーカイブ問わず seq 降順で全件返す', () => {
    const out = allSprintsDesc([s('x', 1, true), s('y', 3), s('z', 2, false)]);
    expect(out.map(v => v.id)).toEqual(['y', 'z', 'x']);
  });
});
