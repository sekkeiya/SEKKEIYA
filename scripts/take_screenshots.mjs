import puppeteer from 'puppeteer';
import fs from 'fs';
if (!fs.existsSync('docs')) {
    fs.mkdirSync('docs');
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log("Taking screenshot of basic UI (Panel closed)...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 60000 });
  // wait another sec just in case models or animations resolve
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/latest_update_03.png' });

  console.log("Taking screenshot of AI Chat...");
  await page.goto('http://localhost:5173/?panel=chat', { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/latest_update_01.png' });

  console.log("Taking screenshot of AI Drive...");
  await page.goto('http://localhost:5173/?panel=drive', { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'docs/latest_update_02.png' });

  await browser.close();
  console.log("Done taking screenshots.");
})();
