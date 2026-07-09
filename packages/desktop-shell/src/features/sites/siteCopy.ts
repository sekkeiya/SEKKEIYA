// 生成サイトの「文言（コピー）」。プロのインテリアデザイナー／建築家の視点で記述。
// 特定案件に依存しない、普遍的で品位のある設計言語を用いる。
// 現状は決定的なテンプレ文。後で LLM 生成（プロジェクト履歴に基づく）へ差し替える継ぎ目。

import type { SiteSectionType, SpecRow, ItemSpecRow, Callout, ComparisonColumn, ChartDatum, ProcessStep, ReferenceItem, UnitRow, UnitPickerEntry, ServiceCard } from '../projects/types';
import type { OnboardingAnswers } from './onboardingScript';

/** ヒーローの一言。 */
export function heroBody(projectName: string, answers: OnboardingAnswers): string {
  if (answers.tagline) return answers.tagline;
  switch (answers.family) {
    case 'record':
      return `完成した ${projectName}。光の移ろいと素材の質感を、ひとつの空間の記録としてお届けします。`;
    case 'portfolio':
      return `これまで手がけてきた仕事を、${projectName} としてまとめました。空間に通底する思想をご覧ください。`;
    case 'residence':
      return `${projectName}。暮らしの豊かさを、ひとつひとつの部屋に込めました。`;
    case 'parcel':
      return `${projectName}。選べる区画、こだわりの仕様で、あなたの住まいをかたちにします。`;
    case 'studio':
      return `${projectName}。設計の力で、空間の可能性を最大限に引き出します。`;
    default:
      return `光と素材、そして人の居場所。${projectName} に込めた設計の思想を、ひとつの物語としてご覧ください。`;
  }
}

/** 概要セクションの本文。 */
export function overviewBody(_projectName: string, answers: OnboardingAnswers): string {
  const lead = answers.tagline ? `${answers.tagline}\n\n` : '';
  return `${lead}敷地の文脈とご要望を丁寧に読み解き、光・風・視線の抜けを手がかりに空間を構成しました。素材は時とともに表情を深める自然素材を基調とし、過ごす人の居心地を第一に考えています。\n\n本ページでは、コンセプトから空間構成、ディテールに至るまでを、順を追ってご覧いただけます。`;
}

/** お問い合わせ（CTA）の本文。 */
export const CTA_BODY = 'プロジェクトのご相談、設計のご依頼を承っております。規模や用途を問わず、構想の段階からお気軽にお声がけください。';

/** 各コンテンツセクションのリード文（見出しの下に添える説明）。 */
const SECTION_INTRO: Partial<Record<SiteSectionType, string>> = {
  unitlist: '現在の空室・販売中住戸の一覧です。お好みの間取りや階数でお選びください。',
  unitpicker: '建物図から区画をお選びください。各棟の面積・価格・現在の状況を確認できます。',
  services: '私たちが提供する業務領域をご紹介します。構想の段階からお気軽にご相談ください。',
  layout: '平面と断面の両面から、空間のボリュームと人の居場所を組み立てます。',
  presentation: '提案の背景にある考え方を、順を追ってご説明します。',
  walkthrough: '歩行目線の映像で、空間のつながりと光の移ろいを体感いただけます。',
  diagram: '環境・構造・動線の考え方を、ダイアグラムで明快に示します。',
  drawing: '平面・断面・立面の図面に、設計の意図を正確に記録しています。',
  gallery: '完成した空間を、光と素材の質感とともに切り取りました。',
  portfolio: 'これまで手がけた代表的なプロジェクトをご紹介します。',
  spec: 'プロジェクトの与条件と概要をまとめています。',
  research: '敷地の周辺を歩き、光・音・人の流れ・街並みとの関係を丁寧に読み取りました。',
  target: 'データから、どんな人が・どんな時間を過ごす場になるのかを読み解きます。',
  regulation: '計画の前提となる法的条件を整理しています。',
  references: '本リサーチで参照した資料・出典の一覧です。',
  process: 'リサーチからコンセプト、そしてプランへ。設計が立ち上がるまでの過程です。',
  zoning: '用途と居心地に応じて空間を性格づけ、過ごし方をやわらかく導くゾーニング。',
  flow: '迎え入れから滞在まで、自然で心地よい動線を計画しました。',
  itemspec: '空間を構成する主な家具・照明・素材と、その仕様です。',
  comparison: '考え方の異なる複数案を並べ、最適な解を探ります。',
};

export function sectionIntro(type: SiteSectionType): string {
  return SECTION_INTRO[type] ?? '';
}

/** 画像キャプションの候補（セクション種別ごと）。サンプル素材に添える。 */
const CAPTIONS: Partial<Record<SiteSectionType, string[]>> = {
  layout: ['全体構成', 'ゾーニング', '動線計画', 'スタディ模型', '空間ボリューム', '断面構成'],
  gallery: ['外観', 'エントランス', '主室', '光の階調', '素材のディテール', '見上げ', '夕景'],
  drawing: ['配置図', '平面図', '断面図', '立面図', '詳細図', '展開図'],
  diagram: ['コンセプト', '環境ダイアグラム', '採光・通風', '構造ダイアグラム', '動線'],
  presentation: ['コンセプト', '与条件の整理', '空間構成', '素材計画', '照明計画'],
  portfolio: ['Project 01', 'Project 02', 'Project 03', 'Project 04', 'Project 05', 'Project 06'],
  walkthrough: ['ウォークスルー'],
};

export function captionFor(type: SiteSectionType, i: number): string | undefined {
  const arr = CAPTIONS[type];
  return arr ? arr[i % arr.length] : undefined;
}

/* ==========================================================
 * 構造化セクションのサンプル内容（プロの設計記述）。
 * 値はプレースホルダ。後で実データ / LLM 生成へ差し替える継ぎ目。
 * =========================================================*/

export function specSample(_projectName: string, _answers: OnboardingAnswers): SpecRow[] {
  return [
    { label: '所在地', value: '— （未設定）' },
    { label: '主用途', value: '住宅' },
    { label: '敷地面積', value: '000.00 ㎡' },
    { label: '延床面積', value: '000.00 ㎡' },
    { label: '構造・階数', value: '木造・地上2階' },
    { label: '竣工', value: '2026 年（予定）' },
  ];
}

export function itemSpecSample(): ItemSpecRow[] {
  return [
    { name: 'ソファ（3人掛け）', spec: 'W2100 × D900 × H720 / SH400', qty: '×1' },
    { name: 'ラウンジチェア', spec: 'W680 × D720 × H700 / SH380', qty: '×2' },
    { name: 'ダイニングテーブル', spec: 'W1800 × D900 × H720', qty: '×1' },
    { name: 'ダイニングチェア', spec: 'W500 × D550 × H800 / SH440', qty: '×6' },
    { name: 'ペンダントライト', spec: 'φ400 / 真鍮・乳白ガラス', qty: '×3' },
    { name: 'フローリング', spec: 'オーク無垢材 / オイル仕上げ', qty: '—' },
  ];
}

export function calloutsFor(type: SiteSectionType): Callout[] {
  if (type === 'flow') {
    return [
      { no: 1, title: 'アプローチ', body: '街並みからの連続性を意識した、迎え入れの動線。' },
      { no: 2, title: 'エントランス', body: '内と外をゆるやかにつなぐ、結節点としての玄関まわり。' },
      { no: 3, title: 'メイン空間への誘導', body: '視線の抜けと採光を手がかりに、自然と奥へと導きます。' },
    ];
  }
  // zoning
  return [
    { no: 1, title: 'パブリックゾーン', body: '訪れた人を迎える、開放的でつながりのある領域。' },
    { no: 2, title: 'セミプライベートゾーン', body: '適度な囲まれ感で、落ち着いて過ごせる中間領域。' },
    { no: 3, title: 'プライベートゾーン', body: '視線と音をやわらかく遮り、静けさを確保した領域。' },
  ];
}

export function comparisonSample(): ComparisonColumn[] {
  return [
    { title: 'A案 — 開放重視', rows: ['ひと続きの大空間', '水平方向の視線の抜け', '可変性の高いレイアウト', '明るく開放的な印象'] },
    { title: 'B案 — 領域重視', rows: ['用途ごとに分節した構成', '籠り感のある居場所', 'プライバシーの確保', '落ち着いた静謐な印象'] },
  ];
}

/* ---- リサーチ / コンセプト / 過程 ---- */

export function researchCalloutsSample(): Callout[] {
  return [
    { no: 1, title: '周辺環境', body: '緑道と低層の住宅地に囲まれ、穏やかな時間が流れる立地。' },
    { no: 2, title: '光と方位', body: '南に開けた敷地。終日にわたり安定した自然光が得られます。' },
    { no: 3, title: '街並みとの関係', body: '周囲のスケールに呼応し、圧迫感のないボリュームを志向します。' },
  ];
}

// 利用者層（ドーナツ）
export function targetChartSample(): ChartDatum[] {
  return [
    { label: 'ファミリー', value: 42 },
    { label: 'シニア', value: 23 },
    { label: '単身・DINKS', value: 20 },
    { label: 'ゲスト', value: 15 },
  ];
}

// 敷地ポテンシャル評価（レーダー・5段階）
export function siteRadarSample(): ChartDatum[] {
  return [
    { label: '日照', value: 4 },
    { label: '眺望', value: 3 },
    { label: 'アクセス', value: 5 },
    { label: '閑静さ', value: 4 },
    { label: '将来性', value: 4 },
  ];
}

// 周辺環境の用途構成（バー・%）
export function contextBarSample(): ChartDatum[] {
  return [
    { label: '住宅', value: 46 },
    { label: '商業', value: 22 },
    { label: '公園・緑地', value: 12 },
    { label: '教育', value: 11 },
    { label: '医療', value: 9 },
  ];
}

// 敷地・周辺調査の地図クエリ（Google Map 埋め込み用のサンプル住所）
export const RESEARCH_MAP_QUERY = '東京都 渋谷区 神宮前';

export function referencesSample(): ReferenceItem[] {
  return [
    { title: '都市計画図（用途地域・建蔽率・容積率）', url: 'https://www.chiseki.go.jp/' },
    { title: '地理院地図 — 国土地理院', url: 'https://maps.gsi.go.jp/' },
    { title: '建築基準法・関連法令 — e-Gov 法令検索', url: 'https://elaws.e-gov.go.jp/' },
    { title: '人口・世帯統計 — e-Stat 政府統計', url: 'https://www.e-stat.go.jp/' },
    { title: '気象・日照データ — 気象庁', url: 'https://www.jma.go.jp/' },
  ];
}

export function regulationRowsSample(): SpecRow[] {
  return [
    { label: '用途地域', value: '第一種低層住居専用地域' },
    { label: '建蔽率 / 容積率', value: '50% / 100%' },
    { label: '高さ制限', value: '10m（絶対高さ）' },
    { label: '防火指定', value: '準防火地域' },
    { label: '斜線制限', value: '道路斜線・北側斜線' },
  ];
}

export function conceptKeywordsSample(): string[] {
  return ['余白', '光の階調', '内と外の連続', '時を重ねる素材'];
}

export const CONCEPT_BODY = 'リサーチで得た敷地の手がかりを、ひとつの言葉に束ねました。過剰な装飾を削ぎ落とし、光・余白・素材の質感によって空間の質を立ち上げます。時間とともに豊かさを増し、住まう人とともに育つ場を目指します。';

export function processStepsSample(): ProcessStep[] {
  return [
    { phase: '01 Research', title: '敷地と人を読む', body: '周辺環境・利用者像・法的条件を丁寧に調査し、設計の手がかりを集めました。' },
    { phase: '02 Concept', title: 'ひとつの言葉へ', body: '集めた情報を、空間を貫くコンセプトへと束ねます。' },
    { phase: '03 Study', title: '試行と検証', body: '複数のスタディを重ね、模型とパースで空間の質を確かめました。' },
    { phase: '04 Plan', title: 'かたちにする', body: 'コンセプトを平面・断面へ翻訳し、具体的なプランへ落とし込みました。' },
  ];
}

/* ==========================================================
 * 新テンプレート用サンプルデータ
 * =========================================================*/

export function unitListSample(): UnitRow[] {
  return [
    { id: '101', name: '101号室', floor: 1, rooms: '1LDK', area: 42.5, balconyArea: 6.2, price: '3,200万円', status: 'available' },
    { id: '102', name: '102号室', floor: 1, rooms: '2LDK', area: 58.3, balconyArea: 8.1, price: '4,100万円', status: 'sold' },
    { id: '201', name: '201号室', floor: 2, rooms: '2LDK', area: 58.3, balconyArea: 8.1, price: '4,300万円', status: 'available' },
    { id: '202', name: '202号室', floor: 2, rooms: '3LDK', area: 72.6, balconyArea: 10.5, price: '5,500万円', status: 'reserved' },
    { id: '301', name: '301号室', floor: 3, rooms: '2LDK', area: 58.3, balconyArea: 8.1, price: '4,500万円', status: 'available' },
    { id: '302', name: '302号室', floor: 3, rooms: '3LDK', area: 72.6, balconyArea: 10.5, price: '5,800万円', status: 'available' },
  ];
}

export function unitPickerSample(): UnitPickerEntry[] {
  return [
    { id: 'A', label: 'A棟', area: 98.5, siteArea: 142.0, price: '6,200万円', status: 'available', spec: '木造2階建て・3LDK' },
    { id: 'B', label: 'B棟', area: 105.2, siteArea: 155.0, price: '6,800万円', status: 'sold', spec: '木造2階建て・3LDK+S' },
    { id: 'C', label: 'C棟', area: 88.0, siteArea: 130.0, price: '5,700万円', status: 'available', spec: '木造2階建て・3LDK' },
    { id: 'D', label: 'D棟', area: 112.8, siteArea: 168.0, price: '7,300万円', status: 'reserved', spec: '木造2階建て・4LDK' },
  ];
}

export function serviceCardsSample(): ServiceCard[] {
  return [
    { title: '住宅設計', icon: '🏠', body: '新築・増改築を問わず、生活の質を高める住まいを提案します。構想の段階からご相談ください。', tags: ['新築', '増改築', '木造・RC・S造'] },
    { title: '集合住宅・分譲', icon: '🏢', body: '市場調査から間取りプランニング、販売支援まで一貫してサポートします。', tags: ['マンション', '長屋', '戸建て分譲'] },
    { title: 'インテリア・リノベーション', icon: '🛋', body: '既存空間のポテンシャルを引き出す、使い勝手の良いリノベーションを行います。', tags: ['住宅', '店舗', 'オフィス'] },
    { title: '商業・店舗設計', icon: '🏪', body: 'ブランドの世界観を空間に翻訳し、訪れる人を引きつける店舗をつくります。', tags: ['飲食', '物販', 'サービス業'] },
    { title: 'コンサルティング', icon: '📐', body: '設計監理・コスト管理・スケジュール管理など、プロジェクト全体をサポートします。', tags: ['設計監理', 'コスト管理', 'CM方式'] },
    { title: '3Dビジュアライゼーション', icon: '🖥', body: '設計意図を正確に伝えるパース・ウォークスルー動画を制作します。', tags: ['CGパース', '動画', 'VR対応'] },
  ];
}
