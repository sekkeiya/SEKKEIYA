/**
 * 編集前のAIリード確認（明確化）。
 *
 * ユーザーの編集指示から、失敗しやすい曖昧点（対象部位＝張地/木部、色味、素材、スタイル、光）を
 * 選択式の質問として組み立てる。回答を補足テキスト化して生成プロンプトに織り込むことで、
 * いきなり生成するより意図のズレを減らす。
 *
 * 現状はキーワードベースのルール生成。将来はサーバーAI（画像＋指示を見て質問を作る）へ
 * 差し替え可能なように、入出力を単純な構造体に保っている。
 */

export interface ClarifyOption { label: string; value: string }
export interface ClarifyQuestion {
  id: string;
  question: string;
  options: ClarifyOption[];
  /** 複数選択可 */
  multi?: boolean;
}

const opt = (labels: string[]): ClarifyOption[] => labels.map((l) => ({ label: l, value: l }));

export function buildClarifyQuestions(instruction: string, o: { hasRegion: boolean }): ClarifyQuestion[] {
  const t = instruction;
  const has = (re: RegExp) => re.test(t);

  const colorIntent = has(/色|カラー|白|黒|赤|青|緑|グレー|グレイ|ベージュ|ネイビー|トーン|明る|暗|色味/);
  const materialIntent = has(/素材|マテリアル|テクスチャ|生地|ファブリック|布|レザー|革|木目|木材|石|大理石|タイル|金属|ステンレス|張地/);
  const replaceIntent = has(/別の|置き換え|差し替え|交換|入れ替え|変えたい|チェア|椅子|ソファ|テーブル|机|棚|家具|照明器具|ランプ/) && !colorIntent;
  const lightIntent = has(/明る|暗|光|照明|朝|昼|夕|夜|間接光|自然光|ライティング/);

  const qs: ClarifyQuestion[] = [];

  // 対象部位（家具の色/素材/置換でよく曖昧になる）
  if (colorIntent || materialIntent || replaceIntent) {
    qs.push({
      id: 'part', multi: true,
      question: o.hasRegion ? '赤枠内のどの部分が対象ですか？' : 'どの部分が対象ですか？',
      options: opt(['張地・クッション', '木部・フレーム', '脚部', '天板', '金属部', '全体']),
    });
  }

  // 素材・テクスチャの種類（Phase2 で S.Image のテクスチャ候補提示に発展）
  if (materialIntent && !replaceIntent) {
    qs.push({
      id: 'material',
      question: 'どんな素材にしますか？',
      options: opt(['ファブリック', 'レザー', '木材（オーク）', '木材（ウォルナット）', '石・大理石', '金属', 'おまかせ']),
    });
  }

  // 色味・質感
  if (colorIntent) {
    qs.push({
      id: 'color',
      question: 'どの色味にしますか？',
      options: opt(['純白', 'オフホワイト', 'ライトグレー', 'チャコール', 'ブラック', 'ベージュ', 'ネイビー', 'ウォルナット', 'おまかせ']),
    });
    qs.push({
      id: 'finish',
      question: '質感は？',
      options: opt(['マット', '半光沢', '光沢', 'そのまま']),
    });
  }

  // 置換のスタイル
  if (replaceIntent) {
    qs.push({
      id: 'style',
      question: 'どんなスタイル・方向性にしますか？',
      options: opt(['北欧', 'モダン', 'ミニマル', 'インダストリアル', 'クラシック', 'おまかせ']),
    });
  }

  // 光（色/素材/置換のいずれでもないとき）
  if (lightIntent && !colorIntent && !materialIntent && !replaceIntent) {
    qs.push({
      id: 'light',
      question: '光の雰囲気は？',
      options: opt(['朝の自然光', '昼光', '夕景', '暖かい間接光', '明るく均一']),
    });
  }

  // どれにも該当しない汎用の1問（保持したい要素）
  if (qs.length === 0) {
    qs.push({
      id: 'keep', multi: true,
      question: '編集で保ちたいものは？',
      options: opt(['構図・アングル', '家具の配置', '全体の明るさ', '素材感', '特になし']),
    });
  }

  return qs;
}

/** 回答を「質問=選択」の補足テキストに変換（生成プロンプトへ織り込む） */
export function buildDetailText(questions: ClarifyQuestion[], answers: Record<string, string[]>): string {
  const parts: string[] = [];
  for (const q of questions) {
    const vals = answers[q.id];
    if (vals && vals.length) parts.push(`${q.question.replace(/[？?]/g, '')}: ${vals.join('・')}`);
  }
  return parts.join(' / ');
}
