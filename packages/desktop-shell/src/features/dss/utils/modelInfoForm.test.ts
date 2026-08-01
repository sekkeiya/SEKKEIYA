import { describe, it, expect } from 'vitest';
import { buildModelInfoForm } from './modelInfoForm';

const baseItem = {
  id: 'm1',
  title: 'sofa 3p ss1',
  type: '3d-model',
  modelType: 'Furniture',
  macroCategory: '家具 (既製品)',
  mainCategory: 'ソファ',
  subCategory: '3人掛け',
  tags: ['sofa'],
  materials: ['ファブリック'],
  dimensions: { width: 2316, depth: 1080, height: 840 },
  price: 248000,
  visibility: 'public',
  relatedLinks: [{ title: '関連リンク', url: 'https://example.com' }],
  catalogLinks: [],
  extendedMetadata: { character: null, gimmick: null },
};

describe('buildModelInfoForm', () => {
  it('同じアイテムからは完全に同一の JSON になる（編集フォームと比較元で形がズレない）', () => {
    // Model Info パネルは editData と originalData を JSON.stringify で丸ごと比較して
    // 「変更あり(hasChanged)」を判定する。両者を別々に組み立てていた頃はキーの有無が
    // 食い違い、ユーザーが何も触っていなくても常に「変更あり」＝自動保存が張り付き、
    // 保存→選択更新→再保存の無限ループになっていた（2026-08-01 実機で発生）。
    const a = buildModelInfoForm(baseItem);
    const b = buildModelInfoForm(baseItem);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.keys(a)).toEqual(Object.keys(b));
  });

  it('保存直後の形（type などがマージされたアイテム）でも一致する', () => {
    // persistModelInfo は保存後に {...selectedItem, ...updatedPayload} を選択へ書き戻す。
    // その形で作り直しても差が出ないこと＝ループが再開しないこと。
    const saved = { ...baseItem, type: '3d-model', name: baseItem.title, sourceUrl: 'https://example.com' };
    expect(JSON.stringify(buildModelInfoForm(saved))).toBe(JSON.stringify(buildModelInfoForm(saved)));
  });

  it('実際に編集された場合は差が出る', () => {
    const edited = { ...baseItem, price: 199000 };
    expect(JSON.stringify(buildModelInfoForm(edited))).not.toBe(JSON.stringify(buildModelInfoForm(baseItem)));
  });

  it('relatedLinks は sourceUrl / sourceUrls からも復元する', () => {
    const legacy = { ...baseItem, relatedLinks: undefined, sourceUrl: 'https://legacy.example.com' };
    expect(buildModelInfoForm(legacy).relatedLinks).toEqual([{ title: '関連リンク', url: 'https://legacy.example.com' }]);

    const legacyMulti = { ...baseItem, relatedLinks: undefined, sourceUrls: ['https://a.example.com', 'https://b.example.com'] };
    expect(buildModelInfoForm(legacyMulti).relatedLinks).toHaveLength(2);
  });

  it('未設定のアイテムでも既定値で埋まる（配列は空・寸法は空文字）', () => {
    const empty = buildModelInfoForm({ id: 'x' });
    expect(empty.title).toBe('Untitled');
    expect(empty.tags).toEqual([]);
    expect(empty.width).toBe('');
    expect(empty.visibility).toBe('public');
    expect(empty.macroCategory).toBe('家具 (既製品)');
  });

  it('造作家具タグ / Architecture から大分類を推定する', () => {
    expect(buildModelInfoForm({ id: 'x', tags: ['造作家具'] }).macroCategory).toBe('家具 (造作)');
    expect(buildModelInfoForm({ id: 'x', modelType: 'Architecture' }).macroCategory).toBe('建築・空間');
  });
});
