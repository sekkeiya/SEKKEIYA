const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  await page.goto('http://localhost:5173/projects', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({ path: 'C:/Users/yumat/.gemini/antigravity/brain/44a1eb86-e3ba-414a-997d-76de213148b0/project_hub_list_v2.png' });
  
  const cards = await page.$$('.MuiCardActionArea-root');
  if (cards.length > 0) {
    await cards[0].click();
    await new Promise(r => setTimeout(r, 5000)); // Wait for workspaces to load
    await page.screenshot({ path: 'C:/Users/yumat/.gemini/antigravity/brain/44a1eb86-e3ba-414a-997d-76de213148b0/project_landing_page_v2.png' });
  }

  await browser.close();
})();
