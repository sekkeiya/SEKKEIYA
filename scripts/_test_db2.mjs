const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const rss = await fetch('https://www.designboom.com/feed/', { headers: { 'User-Agent': UA } }).then(r=>r.text());
const item = rss.split(/<item[\s>]/)[1];
const enc = (/<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(item) || [])[1] || '';
const imgs = enc.match(/<img\b[^>]*>/gi) || [];
console.log('imgタグ総数:', imgs.length);
imgs.forEach((t, i) => console.log(`--- ${i}: ${t.slice(0, 200)}\n`));
