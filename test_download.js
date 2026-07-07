const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const URL   = 'https://microeconomie.github.io/aimeri-todo/';
const EMAIL = 'test.dl.' + Date.now() + '@mailinator.com';
const PWD   = 'TestAimeri2024!';

(async () => {
  const browser = await chromium.launch({
    headless: false, slowMo: 300,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const ctx  = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const dir  = 'C:/Users/AimeriCharon/Desktop/aimeri-todo/screenshots';
  const shot = async (n) => { await page.screenshot({ path: `${dir}/${n}.png` }); console.log('SHOT:' + n); };
  page.on('pageerror', e => console.log('JSERR:' + e.message));

  // Prepare a real test file to upload
  const upFile = path.join(os.tmpdir(), 'aimeri_test_attachment.txt');
  const CONTENT = 'Contenu de test pour le téléchargement — ' + Date.now();
  fs.writeFileSync(upFile, CONTENT);

  const results = {};
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 });
    await page.click('#signupTab');
    await page.fill('#signupEmail', EMAIL);
    await page.fill('#signupPwd', PWD);
    await page.click('#signupBtn');
    await page.waitForSelector('#appScreen.visible', { timeout: 10000 });
    console.log('LOGIN_OK');

    // New task + attach file
    await page.locator('.btn-add').click();
    await page.waitForTimeout(500);
    await page.fill('#mTitle', 'Tâche avec PJ');
    await page.locator('#addFileBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#fileInput').setInputFiles(upFile);
    await page.waitForTimeout(2500); // upload to storage
    results.fileItemShown = await page.locator('.res-item').filter({ hasText: 'aimeri_test_attachment' }).count() > 0;
    results.downloadBtnShown = await page.locator('.res-download').count() > 0;
    console.log('file_item_shown:' + results.fileItemShown + ' | download_btn_shown:' + results.downloadBtnShown);
    await shot('dl_01_uploaded');

    // Save task
    await page.locator('#modalSaveBtn').click();
    await page.waitForTimeout(2000);

    // Reopen and test download
    await page.locator('.card').filter({ hasText: 'avec PJ' }).click();
    await page.waitForTimeout(800);
    results.downloadBtnAfterReopen = await page.locator('.res-download').count() > 0;
    console.log('download_btn_after_reopen:' + results.downloadBtnAfterReopen);

    // Click download and capture the download event
    const [ download ] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.locator('.res-download').first().click(),
    ]);
    const suggested = download.suggestedFilename();
    const savePath  = path.join(os.tmpdir(), 'dl_' + Date.now() + '_' + suggested);
    await download.saveAs(savePath);
    const got = fs.readFileSync(savePath, 'utf8');
    results.downloadFilename = suggested;
    results.contentMatches   = got === CONTENT;
    console.log('downloaded_filename:' + suggested);
    console.log('content_matches_original:' + results.contentMatches);
    await shot('dl_02_downloaded');

    // Cleanup: delete the task (also purges storage)
    await page.locator('#modalSaveBtn').click();
    await page.waitForTimeout(800);
    await page.locator('.card').filter({ hasText: 'avec PJ' }).locator('.del-btn').click();
    await page.waitForTimeout(1500);
    await page.locator('.btn-logout').click();
  } catch (e) {
    console.log('ERROR:' + e.message);
    await page.screenshot({ path: `${dir}/dl_error.png` });
  }
  console.log('\n===== SUMMARY =====');
  console.log(JSON.stringify(results, null, 2));
  await page.waitForTimeout(1000);
  await browser.close();
})();
