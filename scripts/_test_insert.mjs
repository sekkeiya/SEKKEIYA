import { readFileSync } from 'fs';
const src = readFileSync('./functions/reporter/articleVisuals.js', 'utf8');
const fn = eval('(' + src.match(/function insertAfterMdHeading[\s\S]*?\n}/)[0].replace('function insertAfterMdHeading', 'function') + ')');
const body = `# タイトル

導入文です。

## 黄金比とは

説明の段落1。

### 補足

補足の段落。

## 次のセクション

次の内容。`;
const out = fn(body, '黄金比とは', '![図解](URL)', 1);
console.log(out);
console.log('---位置チェック:', out.indexOf('![図解]') > out.indexOf('補足の段落') && out.indexOf('![図解]') < out.indexOf('## 次のセクション') ? 'OK(節末・###も跨いだ)' : 'NG');
