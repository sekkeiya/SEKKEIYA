// 複数ギミック対応の正規化ヘルパー。
// 旧スキーマ（extendedMetadata.gimmick = 単一）と新スキーマ（extendedMetadata.gimmicks = 配列）
// の両方を受け取り、常に配列で返す。各ギミックは安定 id を持つ。

export interface GimmickSpec {
  id: string;
  type: 'hinge' | 'clip' | 'slide';
  label?: string;
  // hinge / slide が使う軸
  axis?: 'x' | 'y' | 'z';
  // hinge
  openDeg?: number;
  pivot?: string;
  // clip
  openClip?: string;
  closeClip?: string;
  // slide（一回再生・移動して停止）: 指定軸へ distance(mm) 動いて止まる。再押下で戻る。
  distance?: number;
}

const isGimmick = (g: any): boolean => !!g && (g.type === 'hinge' || g.type === 'clip' || g.type === 'slide');

/** id を保証（無ければ index ベースの安定 id を付与）。 */
const withId = (g: any, i: number): GimmickSpec => (g.id ? g : { ...g, id: `g${i}` });

/** extendedMetadata（または {gimmicks}/{gimmick} を持つ任意オブジェクト）から配列を得る。 */
export function normalizeGimmicks(meta: any): GimmickSpec[] {
  if (!meta) return [];
  if (Array.isArray(meta.gimmicks)) return meta.gimmicks.filter(isGimmick).map(withId);
  if (isGimmick(meta.gimmick)) return [withId(meta.gimmick, 0)];
  return [];
}

/** 保存用に gimmicks 配列から単一 gimmick（先頭）を取り出す（後方互換フィールド）。 */
export function primaryGimmick(gimmicks: GimmickSpec[]): GimmickSpec | null {
  return gimmicks && gimmicks.length ? gimmicks[0] : null;
}
