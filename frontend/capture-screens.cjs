const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 720 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  const outDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Rename tab (default)
  await page.screenshot({ path: path.join(outDir, '1-rename-current.png') });
  console.log('Saved 1-rename-current.png');

  // 2. Episodes tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('aside button'));
    const epBtn = btns.find(b => b.textContent.includes('Episodes'));
    if (epBtn) epBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, '2-episodes-current.png') });
  console.log('Saved 2-episodes-current.png');

  // 3. Subtitles tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('aside button'));
    const subBtn = btns.find(b => b.textContent.includes('Subtitles'));
    if (subBtn) subBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, '3-subtitles-current.png') });
  console.log('Saved 3-subtitles-current.png');

  // 4. Analyze/Filter tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('aside button'));
    const filterBtn = btns.find(b => b.textContent.includes('Analyze') || b.textContent.includes('Filter'));
    if (filterBtn) filterBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, '4-filter-current.png') });
  console.log('Saved 4-filter-current.png');

  // 5. Switch back to Rename and open Format Editor Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('aside button'));
    const renameBtn = btns.find(b => b.textContent.includes('Rename'));
    if (renameBtn) renameBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  const formatBtn = await page.$('button[title*="Format"]');
  if (formatBtn) {
    await formatBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(outDir, '6-format-editor-current.png') });
    console.log('Saved 6-format-editor-current.png');
  }

  await browser.close();
  console.log('Capture completed successfully.');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
