// gltfClipUtils.js
//
// GLB に含まれる AnimationClip の名前から目的のクリップを推定するヘルパー。
// Blender / Mixamo / 各種DCC でクリップ名がバラつくため、キーワード部分一致で吸収する。
// Phase B（キャラの idle/walk/run）と Phase C（ドア開閉等のギミック）で共用する。

// keywords の順に最初に部分一致したクリップ名を返す（見つからなければ null）
export function pickClipName(names = [], keywords = []) {
  const lowered = names.map((n) => ({ name: n, l: String(n).toLowerCase() }));
  for (const kw of keywords) {
    const hit = lowered.find((x) => x.l.includes(kw));
    if (hit) return hit.name;
  }
  return null;
}

// ロコモーション（idle/walk/run）クリップ名を推定して返す
export function resolveLocomotionClips(names = []) {
  return {
    idle: pickClipName(names, ["idle", "stand", "rest", "tpose", "t-pose", "breath"]),
    walk: pickClipName(names, ["walk", "walking", "move", "step"]),
    run: pickClipName(names, ["run", "running", "sprint", "jog", "dash"]),
  };
}

// ギミック（開閉など）クリップ名を推定（Phase C 用）
export function resolveGimmickClip(names = [], kind = "open") {
  if (kind === "open") return pickClipName(names, ["open", "openning", "opening", "unlock"]);
  if (kind === "close") return pickClipName(names, ["close", "closing", "shut", "lock"]);
  return pickClipName(names, [kind]);
}

// 「開閉ギミックっぽい」クリップ名キーワード（ドア/引き出し/フタ/ゲート 等）
const GIMMICK_HINTS = [
  "open", "close", "door", "gate", "drawer", "lid", "hatch",
  "window", "flip", "slide", "swing", "toggle", "扉", "ドア", "引き出し", "開閉",
];

// このGLBが「クリックで動かす対象」っぽいか（キャラの idle/walk を誤検出しないため、
// 開閉系キーワードに一致するクリップがある場合のみ true）。
export function looksLikeClipGimmick(names = []) {
  if (!names.length) return false;
  return names.some((n) => {
    const l = String(n).toLowerCase();
    return GIMMICK_HINTS.some((h) => l.includes(h));
  });
}

// ロコモーション（キャラ）っぽいクリップしか無い場合は false（ギミック対象外）
export function isLocomotionOnly(names = []) {
  const loco = resolveLocomotionClips(names);
  const hasLoco = !!(loco.idle || loco.walk || loco.run);
  return hasLoco && !looksLikeClipGimmick(names);
}
