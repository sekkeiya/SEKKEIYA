const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const rss = await fetch('https://www.designboom.com/feed/', { headers: { 'User-Agent': UA } }).then(r=>r.text());
const url = (/<item>[\s\S]*?<link>([^<]+)<\/link>/.exec(rss) || [])[1].trim();
console.log('URL:', url.slice(0, 80));
const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
const html = r.ok ? await r.text() : '';
console.log('HTTP', r.status, 'len', html.length);
// article内のimgタグを生で確認
const art = (/<article[^>]*>([\s\S]*?)<\/article>/i.exec(html) || [])[1] || html;
const imgs = art.match(/<img\b[^>]*>/gi) || [];
console.log('imgタグ数(article内):', imgs.length);
imgs.slice(0, 6).forEach((t, i) => console.log(`--- img${i}: ${t.slice(0, 220)}`));
// RSS側 content:encoded の画像
const item = rss.split(/<item[\s>]/)[1] || '';
const enc = (/<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(item) || [])[1] || '';
console.log('\nRSS content:encoded len:', enc.length, '| img数:', (enc.match(/<img/g)||[]).length);
