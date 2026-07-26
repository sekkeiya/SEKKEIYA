import { describe, it, expect } from 'vitest';
import {
  statusOf, isDone, resolveEffective, resizeWidth, type ItemLike,
  isImplementEligible, isTestEligible, autoCheckIds, queueTargetIds,
  CATEGORY_IDS, toolLabel, sortRequirements, filterRequirements,
  allFixesDone, addFix, toggleFix, updateFixText, removeFix,
  timelineTicks, groupByRequest, PX_PER_DAY,
  sprintRangeById, requestSpan, statusBreakdown, completionRate,
  sortByLanding, partitionHistory, isRequestAtRisk, groupRequests,
  type Span,
  DEFAULT_PROJECT_KEY, normalizeProjectKey,
} from './devStatusLogic';

const ms = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getTime();

describe('statusOf / isDone（状態判定）', () => {
  it('明示 status をそのまま返す', () => {
    expect(statusOf({ status: 'manualtest' })).toBe('manualtest');
    expect(statusOf({ status: 'rework' })).toBe('rework');
  });
  it('旧データ: done=true → done', () => {
    expect(statusOf({ done: true })).toBe('done');
    expect(isDone({ done: true })).toBe(true);
  });
  it('旧データ: progress>0 → doing、無し → todo', () => {
    expect(statusOf({ progress: 40 })).toBe('doing');
    expect(statusOf({})).toBe('todo');
    expect(isDone({})).toBe(false);
  });
});

describe('resolveEffective（要件2: 親要求からの継承＋上書き）', () => {
  const parent: ItemLike = { platform: 'desktop', category: '3dss' };
  const byId = (id: string) => (id === 'p1' ? parent : undefined);

  it('要件が値を持たなければ親要求を継承する', () => {
    const eff = resolveEffective({ requestId: 'p1' }, byId);
    expect(eff).toEqual({ platform: 'desktop', category: '3dss' });
  });
  it('要件が自分の値を持てば上書きする', () => {
    const eff = resolveEffective({ requestId: 'p1', platform: 'web', category: 'settings' }, byId);
    expect(eff).toEqual({ platform: 'web', category: 'settings' });
  });
  it('片方だけ上書き（PFは自前・ツールは継承）', () => {
    const eff = resolveEffective({ requestId: 'p1', platform: 'web' }, byId);
    expect(eff).toEqual({ platform: 'web', category: '3dss' });
  });
  it('親要求なし・値なしは null', () => {
    expect(resolveEffective({}, byId)).toEqual({ platform: null, category: null });
  });
});

describe('resizeWidth（要件5: ドラッグ方向と下限）', () => {
  it('右へドラッグ（+）で広がる', () => {
    expect(resizeWidth(100, 50, 60)).toBe(150);
  });
  it('左へドラッグ（-）で縮む', () => {
    expect(resizeWidth(100, -30, 60)).toBe(70);
  });
  it('下限 min を下回らない', () => {
    expect(resizeWidth(100, -80, 60)).toBe(60);
  });
  it('方向が反転していないこと（逆実装なら失敗する回帰テスト）', () => {
    // 逆実装 startW - delta なら 50 になる。正しくは 150。
    expect(resizeWidth(100, 50, 10)).toBeGreaterThan(100);
  });
});

describe('キュー対象抽出（実装/テストの対象状態）', () => {
  it('実装対象は 未着手/着手/要修正 のみ', () => {
    expect(isImplementEligible({ status: 'todo' })).toBe(true);
    expect(isImplementEligible({ status: 'doing' })).toBe(true);
    expect(isImplementEligible({ status: 'rework' })).toBe(true);
    expect(isImplementEligible({ status: 'testing' })).toBe(false);
    expect(isImplementEligible({ status: 'manualtest' })).toBe(false);
    expect(isImplementEligible({ status: 'done' })).toBe(false);
  });
  it('テスト対象は testing のみ', () => {
    expect(isTestEligible({ status: 'testing' })).toBe(true);
    expect(isTestEligible({ status: 'manualtest' })).toBe(false);
    expect(isTestEligible({ status: 'todo' })).toBe(false);
  });

  const reqs = [
    { id: 'a', requestId: 'r1', status: 'todo' as const },
    { id: 'b', requestId: 'r1', status: 'testing' as const },
    { id: 'c', requestId: 'r1', status: 'done' as const },       // 除外
    { id: 'd', requestId: 'r1', status: 'manualtest' as const }, // 除外
    { id: 'e', requestId: 'r2', status: 'todo' as const },       // 別要求
  ];

  it('autoCheckIds は対象状態の子要件だけを返す（完了/手動/別要求は除外）', () => {
    expect(autoCheckIds('r1', reqs).sort()).toEqual(['a', 'b']);
  });
  it('queueTargetIds はチェック集合をモードで絞る', () => {
    const checked = new Set(['a', 'b', 'e']);
    expect(queueTargetIds(checked, reqs, 'implement').sort()).toEqual(['a', 'e']);
    expect(queueTargetIds(checked, reqs, 'test')).toEqual(['b']);
  });
});

describe('ツール選択肢（要件10「全て」/ 要件3「Global Settings」）', () => {
  it('選択肢に「全て」(all) が含まれる', () => {
    expect(CATEGORY_IDS).toContain('all');
    expect(toolLabel('all')).toBe('全て');
  });
  it('選択肢に Global Settings (settings) が含まれる', () => {
    expect(CATEGORY_IDS).toContain('settings');
    expect(toolLabel('settings')).toBe('Global Settings');
  });
  it('自由入力の値はラベルにそのまま出る', () => {
    expect(toolLabel('カスタムツール')).toBe('カスタムツール');
  });
});

describe('sortRequirements（要件12: 列で並び替え・安定）', () => {
  const items = [{ id: 'a', v: 3 }, { id: 'b', v: 1 }, { id: 'c', v: 2 }, { id: 'd', v: 1 }];
  const valueOf = (it: { v: number }) => it.v;
  it('key が null なら元のまま', () => {
    expect(sortRequirements(items, { key: null, dir: 'asc' }, () => 0).map(x => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('昇順（同値 b,d は元順を保つ＝安定）', () => {
    expect(sortRequirements(items, { key: 'status', dir: 'asc' }, valueOf).map(x => x.id)).toEqual(['b', 'd', 'c', 'a']);
  });
  it('降順（同値も安定）', () => {
    expect(sortRequirements(items, { key: 'status', dir: 'desc' }, valueOf).map(x => x.id)).toEqual(['a', 'c', 'b', 'd']);
  });
});

describe('filterRequirements（要件14: 列で絞り込み AND）', () => {
  const items = [
    { id: 'a', status: 'todo', pf: 'desktop' },
    { id: 'b', status: 'done', pf: 'desktop' },
    { id: 'c', status: 'todo', pf: 'web' },
  ];
  const valueKeyOf = (it: { status: string; pf: string }, key: string) => (key === 'status' ? it.status : it.pf);
  it('フィルタ未設定なら全件', () => {
    expect(filterRequirements(items, {}, valueKeyOf).map(x => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('単一列で絞る', () => {
    expect(filterRequirements(items, { status: ['todo'] }, valueKeyOf).map(x => x.id)).toEqual(['a', 'c']);
  });
  it('複数列は AND', () => {
    expect(filterRequirements(items, { status: ['todo'], platform: ['desktop'] }, valueKeyOf).map(x => x.id)).toEqual(['a']);
  });
  it('空配列（全部OFF）は何も通さない', () => {
    expect(filterRequirements(items, { status: [] }, valueKeyOf)).toEqual([]);
  });
});

describe('timelineTicks（要件16: 横軸の目盛り生成）', () => {
  it('月: 月初ごとに目盛り・1月が主目盛り', () => {
    const t = timelineTicks(ms('2025-11-15'), ms('2026-02-10'), 'month');
    expect(t.map(x => x.label)).toEqual(['11月', '12月', '1月', '2月']);
    expect(t.find(x => x.label === '1月')?.major).toBe(true);
    expect(t.find(x => x.label === '11月')?.major).toBe(false);
  });
  it('日: 毎日・1日が主目盛り', () => {
    const t = timelineTicks(ms('2026-01-30'), ms('2026-02-02'), 'day');
    expect(t.map(x => x.label)).toEqual(['1/30', '1/31', '2/1', '2/2']);
    expect(t.find(x => x.label === '2/1')?.major).toBe(true);
  });
  it('週: 月曜起点で7日刻み', () => {
    // 2026-07-20 は月曜。開始が水曜でも直前の月曜へスナップする。
    const t = timelineTicks(ms('2026-07-22'), ms('2026-08-05'), 'week');
    expect(t[0].label).toBe('7/20');
    // 7日刻み
    expect(t[1].ms - t[0].ms).toBe(7 * 86400e3);
  });
  it('年: 年初ごと・すべて主目盛り', () => {
    const t = timelineTicks(ms('2025-06-01'), ms('2027-03-01'), 'year');
    expect(t.map(x => x.label)).toEqual(['2025年', '2026年', '2027年']);
    expect(t.every(x => x.major)).toBe(true);
  });
  it('粒度が細かいほど 1日あたり px が大きい（ズーム関係）', () => {
    expect(PX_PER_DAY.day).toBeGreaterThan(PX_PER_DAY.week);
    expect(PX_PER_DAY.week).toBeGreaterThan(PX_PER_DAY.month);
    expect(PX_PER_DAY.month).toBeGreaterThan(PX_PER_DAY.year);
  });
});

describe('groupByRequest（要件16: 要件を親要求ごとにネスト）', () => {
  it('要求の初出順を保ち、同じ要求の要件をまとめる', () => {
    const reqs = [
      { id: 'a', requestId: 'r1' },
      { id: 'b', requestId: 'r2' },
      { id: 'c', requestId: 'r1' },
    ];
    expect(groupByRequest(reqs)).toEqual([
      { requestId: 'r1', requirementIds: ['a', 'c'] },
      { requestId: 'r2', requirementIds: ['b'] },
    ]);
  });
  it('親要求なし（null/undefined）は末尾の null グループへ集約', () => {
    const reqs = [
      { id: 'a', requestId: 'r1' },
      { id: 'b', requestId: null },
      { id: 'c' },
    ];
    expect(groupByRequest(reqs)).toEqual([
      { requestId: 'r1', requirementIds: ['a'] },
      { requestId: null, requirementIds: ['b', 'c'] },
    ]);
  });
  it('空配列は空グループ', () => {
    expect(groupByRequest([])).toEqual([]);
  });
});

describe('要求ロードマップ（要求主軸の算出）', () => {
  const sprints = [
    { id: 's1', seq: 1, startDate: '2026-07-01', endDate: '2026-07-14' },
    { id: 's2', seq: 2, startDate: '2026-07-15', endDate: '2026-07-28' },
    { id: 's3', seq: 3, startDate: '2026-07-29', endDate: '2026-08-11' },
  ];
  const rangeById = sprintRangeById(sprints);

  it('requestSpan: 複数スプリントにまたがる最早〜最遅', () => {
    const reqs = [{ sprintId: 's1' }, { sprintId: 's3' }, { sprintId: 's2' }];
    const sp = requestSpan(reqs, rangeById);
    expect(sp).toEqual({ startMs: ms('2026-07-01'), endMs: ms('2026-08-12') }); // s3終了8/11の翌0時
  });
  it('requestSpan: 全て未割当なら null', () => {
    expect(requestSpan([{ sprintId: null }, {}], rangeById)).toBeNull();
  });
  it('requestSpan: 一部だけ割当ならその範囲', () => {
    const sp = requestSpan([{ sprintId: 's2' }, { sprintId: null }], rangeById);
    expect(sp).toEqual({ startMs: ms('2026-07-15'), endMs: ms('2026-07-29') });
  });

  it('statusBreakdown: 状態ごと集計・表示順・0件除外', () => {
    const reqs = [
      { status: 'done' as const }, { status: 'done' as const },
      { status: 'todo' as const }, { status: 'testing' as const },
    ];
    expect(statusBreakdown(reqs)).toEqual([
      { status: 'done', count: 2 },
      { status: 'testing', count: 1 },
      { status: 'todo', count: 1 },
    ]);
  });
  it('completionRate: done 割合', () => {
    expect(completionRate([{ status: 'done' }, { status: 'todo' }])).toBe(0.5);
    expect(completionRate([])).toBe(0);
  });

  it('sortByLanding: 着地順・未定は末尾・同着は seq', () => {
    const items = [
      { id: 'late', span: { startMs: 0, endMs: 300 } as Span | null, seq: 9 },
      { id: 'none', span: null as Span | null, seq: 1 },
      { id: 'earlyB', span: { startMs: 0, endMs: 100 } as Span | null, seq: 5 },
      { id: 'earlyA', span: { startMs: 0, endMs: 100 } as Span | null, seq: 2 },
    ];
    const sorted = sortByLanding(items, i => i.span, i => i.seq).map(i => i.id);
    expect(sorted).toEqual(['earlyA', 'earlyB', 'late', 'none']);
  });

  it('partitionHistory: 過去完了のみ history', () => {
    const today = ms('2026-08-01');
    const items = [
      { id: 'pastDone', span: { startMs: 0, endMs: ms('2026-07-20') } as Span | null, done: true },
      { id: 'pastOpen', span: { startMs: 0, endMs: ms('2026-07-20') } as Span | null, done: false },
      { id: 'futureDone', span: { startMs: 0, endMs: ms('2026-09-01') } as Span | null, done: true },
      { id: 'undef', span: null as Span | null, done: true },
    ];
    const { active, history } = partitionHistory(items, i => i.span, i => i.done, today);
    expect(history.map(i => i.id)).toEqual(['pastDone']);
    expect(active.map(i => i.id)).toEqual(['pastOpen', 'futureDone', 'undef']);
  });

  it('isRequestAtRisk: 期限切れ未完で true / 完了・未来は false', () => {
    const today = ms('2026-08-01');
    // s1(7/14終了) は今日より前
    expect(isRequestAtRisk([{ sprintId: 's1', status: 'todo' }], rangeById, today)).toBe(true);
    expect(isRequestAtRisk([{ sprintId: 's1', status: 'done' }], rangeById, today)).toBe(false);
    expect(isRequestAtRisk([{ sprintId: 's3', status: 'todo' }], rangeById, today)).toBe(false); // s3は未来
    expect(isRequestAtRisk([{ sprintId: null, status: 'todo' }], rangeById, today)).toBe(false);
  });

  it('groupRequests: none は1グループ / category は初出順', () => {
    const list = [{ id: 'a', c: '3dss' }, { id: 'b', c: '3dsl' }, { id: 'c', c: '3dss' }];
    expect(groupRequests(list, 'none', i => i.c)).toEqual([{ key: null, items: list }]);
    const g = groupRequests(list, 'category', i => i.c);
    expect(g.map(x => x.key)).toEqual(['3dss', '3dsl']);
    expect(g[0].items.map(i => i.id)).toEqual(['a', 'c']);
  });
});

describe('修正項目（要件下の修正チェックリスト）', () => {
  const fixes = [{ id: 'x', text: 'a', done: false }, { id: 'y', text: 'b', done: true }];
  it('allFixesDone: 空/undefined は false、全部 done で true、一部未完は false', () => {
    expect(allFixesDone([])).toBe(false);
    expect(allFixesDone(undefined)).toBe(false);
    expect(allFixesDone([{ id: '1', text: '', done: true }])).toBe(true);
    expect(allFixesDone(fixes)).toBe(false);
  });
  it('addFix: 末尾に未完で追加（trim）', () => {
    const r = addFix(fixes, 'z', ' c ');
    expect(r).toHaveLength(3);
    expect(r[2]).toEqual({ id: 'z', text: 'c', done: false });
  });
  it('addFix: undefined からも追加できる', () => {
    expect(addFix(undefined, 'a', 'x')).toEqual([{ id: 'a', text: 'x', done: false }]);
  });
  it('toggleFix: 指定 id の done を反転', () => {
    expect(toggleFix(fixes, 'x')[0].done).toBe(true);
    expect(toggleFix(fixes, 'y')[1].done).toBe(false);
  });
  it('updateFixText / removeFix', () => {
    expect(updateFixText(fixes, 'x', 'A')[0].text).toBe('A');
    expect(removeFix(fixes, 'x').map(f => f.id)).toEqual(['y']);
  });
});

describe('normalizeProjectKey', () => {
  it('未設定・空・空白は既定キーになる', () => {
    expect(normalizeProjectKey(undefined)).toBe('sekkeiya');
    expect(normalizeProjectKey(null)).toBe('sekkeiya');
    expect(normalizeProjectKey('')).toBe('sekkeiya');
    expect(normalizeProjectKey('   ')).toBe('sekkeiya');
  });
  it('既定キーは公開定数と一致する', () => {
    expect(DEFAULT_PROJECT_KEY).toBe('sekkeiya');
    expect(normalizeProjectKey(undefined)).toBe(DEFAULT_PROJECT_KEY);
  });
  it('値があれば trim して返す', () => {
    expect(normalizeProjectKey('  other-app ')).toBe('other-app');
  });
});
