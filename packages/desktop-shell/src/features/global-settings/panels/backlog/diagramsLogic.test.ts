// diagramsLogic の純ロジックテスト。fs / React には触れない（localBacklogLogic.test.ts と同じ流儀）。
import { describe, it, expect } from 'vitest';
import {
  DIAGRAM_TYPES, isDiagramType, emptyDiagramsMeta,
  parseDiagramsMeta, serializeDiagramsMeta, setMetaEntry,
} from './diagramsLogic';

describe('isDiagramType', () => {
  it('4種を受理し、それ以外を拒否する', () => {
    for (const t of ['system', 'er', 'screens', 'flow']) expect(isDiagramType(t)).toBe(true);
    expect(isDiagramType('dfd')).toBe(false);
    expect(isDiagramType(null)).toBe(false);
    expect(isDiagramType(1)).toBe(false);
  });
});

describe('DIAGRAM_TYPES', () => {
  it('4種の定義があり、日本語ラベルと Mermaid サンプルを持つ', () => {
    expect(DIAGRAM_TYPES.map(d => d.key)).toEqual(['system', 'er', 'screens', 'flow']);
    for (const d of DIAGRAM_TYPES) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.sample.length).toBeGreaterThan(0);
    }
  });
});

describe('parseDiagramsMeta / serializeDiagramsMeta', () => {
  it('空メタを roundtrip できる', () => {
    const meta = emptyDiagramsMeta();
    expect(parseDiagramsMeta(serializeDiagramsMeta(meta))).toEqual(meta);
  });
  it('不正 JSON は throw する', () => {
    expect(() => parseDiagramsMeta('{oops')).toThrow();
  });
  it('オブジェクトでない JSON は throw する', () => {
    expect(() => parseDiagramsMeta('[1,2]')).toThrow();
  });
  it('未知の図タイプは捨て、既知タイプだけ残す', () => {
    const meta = parseDiagramsMeta(JSON.stringify({
      version: 1,
      diagrams: { er: { queue: 'generate' }, bogus: { queue: 'generate' } },
    }));
    expect(meta.diagrams.er?.queue).toBe('generate');
    expect((meta.diagrams as Record<string, unknown>).bogus).toBeUndefined();
  });
  it('queue が generate 以外の値なら null に落とす', () => {
    const meta = parseDiagramsMeta(JSON.stringify({
      version: 1, diagrams: { er: { queue: 'implement' } },
    }));
    expect(meta.diagrams.er?.queue).toBeNull();
  });
  it('直列化は 2 スペース整形＋末尾改行（git diff 安定）', () => {
    const text = serializeDiagramsMeta(emptyDiagramsMeta());
    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('  "version": 1');
  });
});

describe('setMetaEntry', () => {
  it('対象タイプだけ更新し updatedAt を刻む。他タイプは保持', () => {
    const base = setMetaEntry(emptyDiagramsMeta(), 'er', { queue: 'generate', queueNote: 'テーブル追加' }, '2026-08-01T00:00:00.000Z');
    const next = setMetaEntry(base, 'flow', { queue: 'generate' }, '2026-08-01T01:00:00.000Z');
    expect(next.diagrams.er).toEqual({ queue: 'generate', queueNote: 'テーブル追加', updatedAt: '2026-08-01T00:00:00.000Z' });
    expect(next.diagrams.flow?.updatedAt).toBe('2026-08-01T01:00:00.000Z');
  });
  it('元のオブジェクトを破壊しない', () => {
    const base = emptyDiagramsMeta();
    setMetaEntry(base, 'er', { queue: 'generate' }, '2026-08-01T00:00:00.000Z');
    expect(base.diagrams.er).toBeUndefined();
  });
});
