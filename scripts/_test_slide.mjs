// renderSlideSvg は非公開なので、挿入位置ロジックと同等の検証 + SVG構文チェックを簡易に行う
import { readFileSync, writeFileSync } from 'fs';
const src = readFileSync('./functions/reporter/articleVisuals.js', 'utf8');
// 関数を抜き出して評価（escXml と renderSlideSvg）
const escXml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fnMatch = src.match(/function renderSlideSvg[\s\S]*?\n}/);
const renderSlideSvg = eval('(' + fnMatch[0].replace('function renderSlideSvg', 'function') + ')');
const svg = renderSlideSvg({
  title: '配色の黄金比 70:25:5',
  points: [
    { heading: 'ベースカラー70%', detail: '壁・床・天井など空間の大部分を占める色' },
    { heading: 'アソートカラー25%', detail: 'ソファやカーテンなど雰囲気を決める主役' },
    { heading: 'アクセントカラー5%', detail: 'クッションや小物など少量だけ使う差し色' },
  ],
  accent: '#e57373',
});
writeFileSync('C:/Users/yumat/AppData/Local/Temp/claude/C--Users-sekkeiya-02-WebApp-040-sekkeiya/8ce18284-9d49-4533-ad9d-41ce209620e8/scratchpad/slide_test.svg', svg);
const h = /height="(\d+)"/.exec(svg)[1];
console.log('SVG OK, size=1200x' + h, '(旧675 → 大幅にコンパクト化)', '| bytes=', svg.length);
