// manifest の engine と本体の公開 API バージョンの照合（要件72 の土台）。
// semver ライブラリは入れない。対応する range は完全一致とキャレットだけなので、
// 依存を増やすより 30 行書くほうが安い。
//
// engine は「本体のアプリバージョン」ではなく「公開 API のバージョン」に対して書く。
// アプリは頻繁に上がるが API はめったに変わらないため、アプリ版で判定すると
// API が何も変わっていないのに全プラグインが非対応になる。

/** 公開 API のバージョン。src/features/plugins/sdk/publicApi.ts を壊す変更をしたら上げる。 */
export const API_VERSION = '1.0.0';

type Triple = [number, number, number];

/** "1.2.3" / "1.2.3-beta.1" → [1,2,3]。読めなければ null。 */
function parseVersion(v: string): Triple | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** "1.2.3-beta.1" のようにプレリリース接尾辞を含むか。 */
function hasPrerelease(v: string): boolean {
  return v.includes('-');
}

/** a >= b か。 */
function gte(a: Triple, b: Triple): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

/**
 * range が version を満たすか。
 * 対応する形式は "1.2.3"（完全一致）と "^1.2.3"（キャレット）のみ。
 * それ以外は false（validateManifest が事前に弾いているが、ここでも通さない）。
 */
export function satisfiesEngine(range: string, version: string): boolean {
  // プレリリースの順序比較は semver の中でも間違えやすい部分で、静かに誤判定する
  // くらいなら受け付けないほうが安全。必要になったら緩める。
  if (hasPrerelease(range) || hasPrerelease(version)) return false;

  const target = parseVersion(version);
  if (!target) return false;

  if (range.startsWith('^')) {
    const base = parseVersion(range.slice(1));
    if (!base) return false;
    if (!gte(target, base)) return false;
    // semver のキャレット:
    // 0.0.z は patch が major 相当（完全一致のみ）
    if (base[0] === 0 && base[1] === 0) {
      return target[0] === 0 && target[1] === 0 && target[2] === base[2];
    }
    // 0.y.z（y > 0）は minor が major 相当
    if (base[0] === 0) return target[0] === 0 && target[1] === base[1];
    return target[0] === base[0];
  }

  const exact = parseVersion(range);
  if (!exact) return false;
  return exact[0] === target[0] && exact[1] === target[1] && exact[2] === target[2];
}

/** 非対応のときにユーザーへ出す一文。 */
export function engineErrorMessage(range: string): string {
  return `このプラグインは API ${range} に対応していますが、本体の API は ${API_VERSION} です。`;
}
