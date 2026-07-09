import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ── 2階層タクソノミー（ハブ=検索意図 / サブ=各アプリ・具体テーマ）──
const TAXO = [
  // hubs
  { name:'お知らせ・最新情報', slug:'news', order:1, parent:null, description:'SEKKEIYA公式のお知らせ・アップデート・AI業界ニュース' },
  { name:'AI × 空間設計', slug:'ai-design', order:2, parent:null, description:'AIで建築・インテリアを設計する手法と事例' },
  { name:'3Dモデル・マテリアル', slug:'3d-models', order:3, parent:null, description:'3Dモデルの作成・管理・共有、テクスチャ・PBR素材' },
  { name:'間取り・空間レイアウト', slug:'space-planning', order:4, parent:null, description:'間取り作成・家具の自動配置・造作家具・環境ダイアグラム' },
  { name:'設計プレゼン・図面', slug:'presentation', order:5, parent:null, description:'3Dプレゼン・図面・ポートフォリオ・動画で伝える設計' },
  { name:'制作ワークフロー・連携', slug:'workflow-hub', order:6, parent:null, description:'Rhino連携・データ変換・Desktopアプリ・チーム制作' },
  { name:'使い方・学習', slug:'learn', order:7, parent:null, description:'チュートリアル・学習コース・ナレッジ' },
  // subs: news
  { name:'SEKKEIYA', slug:'sekkeiya', order:11, parent:'news', description:'SEKKEIYAのブランド・思想・会社情報' },
  { name:'リリースノート', slug:'release-notes', order:12, parent:'news', description:'機能追加・改善・修正のまとめ' },
  { name:'AI News', slug:'ai-news', order:13, parent:'news', description:'建築・設計×AIの最新動向・ツール比較' },
  // subs: ai-design
  { name:'AIレンダリング', slug:'ai-render', order:21, parent:'ai-design', description:'AIによるフォトリアル建築パース・レンダリング' },
  { name:'AI 3D生成', slug:'ai-3d-create', order:22, parent:'ai-design', description:'画像・テキストからのAI 3Dモデル生成' },
  { name:'AI設計対話', slug:'ai-chat', order:23, parent:'ai-design', description:'AIチャットで設計を進めるノウハウ' },
  // subs: 3d-models
  { name:'S.Models', slug:'s-models', order:31, parent:'3d-models', description:'3Dモデルの管理・共有・プレビュー' },
  { name:'S.Material', slug:'s-material', order:32, parent:'3d-models', description:'PBRマテリアル・テクスチャの作成と管理' },
  { name:'S.Image', slug:'s-image', order:33, parent:'3d-models', description:'画像・テクスチャ素材の整理' },
  // subs: space-planning
  { name:'S.Layout', slug:'s-layout', order:41, parent:'space-planning', description:'間取り・家具の自動レイアウトと最適配置' },
  { name:'S.Create', slug:'s-create', order:42, parent:'space-planning', description:'造作家具・オリジナル家具の設計' },
  { name:'S.Diagram', slug:'s-diagram', order:43, parent:'space-planning', description:'日照・配置・敷地・環境ダイアグラム' },
  // subs: presentation
  { name:'S.Presentations', slug:'s-presentations', order:51, parent:'presentation', description:'歩ける3Dプレゼン・ウォークスルー' },
  { name:'S.Drawing', slug:'s-drawing', order:52, parent:'presentation', description:'図面・設計図書のクラウド管理' },
  { name:'S.Portfolio', slug:'s-portfolio', order:53, parent:'presentation', description:'建築・インテリアのPDFポートフォリオ' },
  { name:'S.Movie', slug:'s-movie', order:54, parent:'presentation', description:'建築ウォークスルー動画・シーケンス編集' },
  // subs: workflow-hub
  { name:'Rhino連携', slug:'rhino', order:61, parent:'workflow-hub', description:'Rhinoとの往復ワークフロー・プラグイン' },
  { name:'データ変換', slug:'data-conversion', order:62, parent:'workflow-hub', description:'3dm/GLB変換・座標系・メッシュ最適化' },
  { name:'Desktop', slug:'desktop', order:63, parent:'workflow-hub', description:'SEKKEIYA Desktopアプリ・開発' },
  { name:'Teams', slug:'teams', order:64, parent:'workflow-hub', description:'チームでの共同制作・権限管理' },
  // subs: learn
  { name:'チュートリアル', slug:'tutorial', order:71, parent:'learn', description:'使い方・入門ガイド・開発Tips' },
  { name:'S.Quest', slug:'s-quest', order:72, parent:'learn', description:'建築・インテリア学習コース' },
  { name:'S.Library', slug:'s-library', order:73, parent:'learn', description:'製品資料・ナレッジライブラリ' },
];

// 1) 既存カテゴリを全削除して作り直し（冪等）
const old = await db.collection('categories').get();
for (const d of old.docs) await d.ref.delete();
for (const c of TAXO) {
  await db.collection('categories').add({ ...c, active: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
console.log(`categories rebuilt: deleted ${old.size}, created ${TAXO.length}`);

// 2) 既存9記事を 新カテゴリ(ハブ)+サブカテゴリ に再マッピング
const cat = (slug) => { const t = TAXO.find(x=>x.slug===slug); return { slug: t.slug, name: t.name }; };
const MAP = {
  HA5lPJDfX6KT4xXLi0bP: ['news', 'release-notes'],
  EDdoeLuRwMCXaI9Yh6Qu: ['news', 'sekkeiya'],
  '6jWN5n8O97UoYmHQ2Idh': ['3d-models', 's-models'],
  r2AN2YLmQYuOmyW0dYnt: ['3d-models', 's-models'],
  gMVQK6OivIBtn8QH6Vm8: ['workflow-hub', 'data-conversion'],
  IQ4lNEOdgdB6yHazNmbG: ['workflow-hub', 'rhino'],
  SE8pQ7WW4HakXYj6lHtb: ['workflow-hub', 'rhino'],
  dl5uVf9ST2Mm5dcObhbe: ['learn', 'tutorial'],
  rUblyivQEGAiu97SMxQW: ['learn', 'tutorial'],
};
let n = 0;
for (const [id, [hub, sub]] of Object.entries(MAP)) {
  await db.collection('officialArticles').doc(id).update({ category: cat(hub), subCategory: cat(sub) });
  n++;
}
console.log(`articles re-categorized: ${n}`);
console.log('done');
process.exit(0);
