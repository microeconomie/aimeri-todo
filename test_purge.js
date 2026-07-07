const { chromium } = require('playwright');

const URL   = 'https://microeconomie.github.io/aimeri-todo/';
const EMAIL = 'test.purge.' + Date.now() + '@mailinator.com';
const PWD   = 'TestAimeri2024!';

(async () => {
  const browser = await chromium.launch({
    headless: false, slowMo: 300,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage();
  const dir  = 'C:/Users/AimeriCharon/Desktop/aimeri-todo/screenshots';
  const shot = async (n) => { await page.screenshot({ path: `${dir}/${n}.png` }); console.log('SHOT:' + n); };
  page.on('pageerror', e => console.log('JSERR:' + e.message));

  const results = {};
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 });
    await page.click('#signupTab');
    await page.fill('#signupEmail', EMAIL);
    await page.fill('#signupPwd', PWD);
    await page.click('#signupBtn');
    await page.waitForSelector('#appScreen.visible', { timeout: 10000 });
    console.log('LOGIN_OK');

    // Banner hidden while no done task
    await page.locator('#tab-done').click();
    await page.waitForTimeout(500);
    results.bannerHiddenWhenEmpty = !(await page.locator('#purgeNotice.show').count() > 0);
    console.log('banner_hidden_when_no_done_task:' + results.bannerHiddenWhenEmpty);

    // Create + complete a task
    await page.locator('#tab-pending').click();
    await page.locator('.btn-add').click();
    await page.waitForTimeout(500);
    await page.fill('#mTitle', 'Tâche purge test');
    await page.locator('#modalSaveBtn').click();
    await page.waitForTimeout(2000);
    await page.locator('.card').filter({ hasText: 'purge test' }).locator('.done-btn').click();
    await page.waitForTimeout(1300);

    // Banner visible in done tab
    await page.locator('#tab-done').click();
    await page.waitForTimeout(600);
    results.bannerVisible = await page.locator('#purgeNotice.show').count() > 0;
    results.bannerText = (await page.locator('#purgeNotice span').textContent()).trim();
    console.log('banner_visible_with_done_task:' + results.bannerVisible);
    console.log('banner_text:"' + results.bannerText + '"');
    await shot('purge_01_banner');

    // Verify purge function exists and cutoff logic (simulate: no task is >30d, so nothing purged)
    const purgeFnOk = await page.evaluate(() => typeof purgeExpiredDoneTasks === 'function' && typeof PURGE_DAYS !== 'undefined' && PURGE_DAYS === 30);
    results.purgeFnOk = purgeFnOk;
    console.log('purge_fn_present_and_30d:' + purgeFnOk);

    // Simulate an expired done task by back-dating doneAt in memory, then run purge
    const purgedCount = await page.evaluate(async () => {
      const t = tasks.find(x => x.title === 'Tâche purge test');
      if (!t) return -1;
      t.doneAt = Date.now() - 31 * 86400 * 1000; // 31 days ago
      const before = tasks.length;
      await purgeExpiredDoneTasks();
      return before - tasks.length;
    });
    results.simulatedPurge = purgedCount === 1;
    console.log('simulated_31d_purge_removed_task:' + (purgedCount === 1 ? 'OK' : 'FAIL(' + purgedCount + ')'));

    // Confirm it's gone from done grid + DB (reload)
    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.locator('#tab-done').click();
    await page.waitForTimeout(500);
    results.purgedAfterReload = await page.locator('.card').filter({ hasText: 'purge test' }).count() === 0;
    console.log('task_gone_after_reload(DB_purged):' + results.purgedAfterReload);
    await shot('purge_02_after');

    await page.locator('.btn-logout').click();
  } catch (e) {
    console.log('ERROR:' + e.message);
    await page.screenshot({ path: `${dir}/purge_error.png` });
  }
  console.log('\n===== SUMMARY =====');
  console.log(JSON.stringify(results, null, 2));
  await page.waitForTimeout(1200);
  await browser.close();
})();
