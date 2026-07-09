// generateSiteNarration のロジックをデプロイ前にローカル検証する
// 使い方: ANTHROPIC_API_KEY を env に入れて node scripts/_verify_narration_0704.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { generateSiteNarration } = require('../functions/orchestrator/generateSiteNarration.js');

const sections = [
  { id: 'hero1', text: '軽井沢の週末住宅\n森に開く、静かな平屋の提案' },
  { id: 'concept1', text: 'コンセプト\n南の落葉樹林へ大きく開き、夏は木陰、冬は陽だまりをつくる住まい。\nキーワード: 平屋、回遊動線、薪ストーブ' },
  { id: 'spec1', text: 'プロジェクト概要\n所在地: 長野県北佐久郡軽井沢町 / 用途: 別荘（週末住宅） / 構造: 木造平屋 / 延床面積: 約98㎡ / 想定工期: 8ヶ月' },
  { id: 'zoning1', text: '計画方針\n1. 南面開口: リビングを南の樹林に向けて全面開口: 冬の日射取得と眺望を最大化 / 2. 回遊動線: 水回りを中心に配置し家事動線を短縮' },
  { id: 'gallery1', text: '（gallery の画像・アセット 4点）' },
  { id: 'closing1', text: 'お問い合わせ\nご相談・現地見学のご希望はお気軽にご連絡ください。' },
];

const t0 = Date.now();
const r = await generateSiteNarration({ projectName: '軽井沢の週末住宅', sections });
console.log('took:', Date.now() - t0, 'ms');
for (const n of r.narrations) console.log(`\n[${n.id}]\n${n.narration}`);
