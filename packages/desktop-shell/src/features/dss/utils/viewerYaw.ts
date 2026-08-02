/**
 * 詳細画面ビューアに渡す「GLB の向き補正」(Y 軸回りの度数) の解決。
 *
 * yawDeg は *モデル固有* の値であり、編集中の一時値ではない。ところが編集中の即時反映に
 * 使う `useDssLiveDimensionsStore` は OverviewSection だけでなく DssRightPanel も書いており、
 * 後者は `{width, depth, height}` しか入れない。liveDimensions を無条件に正とすると、
 * 右パネル由来の書き込みで yawDeg が失われ、リロード直後の閲覧モードだけ補正が効かず
 * W/D が崩れる（2026-08-02 に実際に発生）。
 *
 * そこで「liveDims が yawDeg を明示的に持つときだけそれを使い、無ければモデルの値へ落とす」
 * という解決順にする。0 と未設定を区別する必要があるため `??` で判定する（`||` だと
 * 明示的な 0 がモデル値に上書きされてしまう）。
 */
/**
 * 呼び出し側は `{width, depth, height, ...}` の寸法オブジェクトをそのまま渡す。
 * インデックスシグネチャが無いと TypeScript の weak type 検出（省略可プロパティのみの型に
 * 共通プロパティを持たない値を渡すとエラー）に引っかかるため、余剰プロパティを許可する。
 */
type YawSource = { yawDeg?: number; [key: string]: unknown };

export interface ResolveViewerYawInput {
  /** 置き換え候補を表示中か。true なら候補自身の補正だけを見る。 */
  swapActive?: boolean;
  swapDims?: YawSource | null;
  liveDims?: YawSource | null;
  modelDims?: YawSource | null;
}

/** 解決結果は 0 か 90 のみ。想定外の値は 0 に丸める。 */
export function resolveViewerYawDeg({
  swapActive, swapDims, liveDims, modelDims,
}: ResolveViewerYawInput): 0 | 90 {
  const raw = swapActive
    ? swapDims?.yawDeg
    : (liveDims?.yawDeg ?? modelDims?.yawDeg);
  return Number(raw) === 90 ? 90 : 0;
}
