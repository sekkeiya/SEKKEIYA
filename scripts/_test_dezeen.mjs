const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const rss = await fetch('https://www.dezeen.com/feed/', { headers: { 'User-Agent': UA } }).then(r=>r.text());
const link = (/<item>[\s\S]*?<link>([^<]+)<\/link>/.exec(rss) || [])[1].trim();
const tests = [
  ['UA only', { 'User-Agent': UA }],
  ['UA+Accept+Referer', { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', 'Referer': 'https://www.google.com/', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'cross-site', 'Upgrade-Insecure-Requests': '1' }],
];
for (const pair of tests) {
  const r = await fetch(link, { headers: pair[1], redirect: 'follow' });
  console.log(pair[0], '=>', r.status);
}
const enc = /<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(rss);
console.log('RSS content:encoded length:', enc ? enc[1].length : 0, '| has <img>:', enc ? /<img/.test(enc[1]) : false);
