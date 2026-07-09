import { readFileSync } from 'fs';
const src = readFileSync('./functions/reporter/blogDialogue.js', 'utf8');
const decodeEntities = (s) => String(s || '')
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
  .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _; } })
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const extractReadableBlocks = eval('(' + src.match(/function extractReadableBlocks[\s\S]*?\n  return blocks;\n}/)[0].replace('function extractReadableBlocks', 'function') + ')');
const extractFeedItemImage = eval('(' + src.match(/function extractFeedItemImage[\s\S]*?\n  return "";\n}/)[0].replace('function extractFeedItemImage', 'function') + ')');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ① designboom: RSS版 vs ページ版のスコア採用確認
const dbRss = await fetch('https://www.designboom.com/feed/', { headers: { 'User-Agent': UA } }).then(r=>r.text());
const url = (/<item>[\s\S]*?<link>([^<]+)<\/link>/.exec(dbRss) || [])[1].trim();
const item = dbRss.split(/<item[\s>]/).find((it) => it.includes(url.replace(/\/$/, '')));
const enc = (/<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(item) || [])[1] || '';
const inner = enc.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
const rssBlocks = extractReadableBlocks(inner, url);
console.log(`designboom RSS版: p=${rssBlocks.filter(b=>b.t==='p').length} img=${rssBlocks.filter(b=>b.t==='img').length}`);

// ② 各フィードのサムネイル取得率
for (const [name, feed] of [
  ['architecturephoto','https://architecturephoto.net/feed/'],
  ['Casa BRUTUS','https://casabrutus.com/feed'],
  ['RoomClip','https://roomclip.jp/mag/feed'],
  ['SUUMO','https://suumo.jp/journal/feed/'],
  ['dezeen','https://www.dezeen.com/feed/'],
  ['designboom','https://www.designboom.com/feed/'],
  ['ArchDaily','https://www.archdaily.com/rss/'],
  ['AXIS','https://www.axismag.jp/feed/'],
  ['JDN','https://www.japandesign.ne.jp/feed/'],
]) {
  try {
    const xml = await fetch(feed, { headers: { 'User-Agent': UA } }).then(r=>r.text());
    const blocks = xml.split(/<item[\s>]|<entry[\s>]/).slice(1, 9);
    const withImg = blocks.filter(b => extractFeedItemImage(b)).length;
    console.log(`${name.padEnd(18)} サムネ ${withImg}/${blocks.length}`);
  } catch(e) { console.log(name, 'ERR', e.message); }
}
