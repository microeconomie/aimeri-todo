const { chromium } = require('playwright');

const URL   = 'https://microeconomie.github.io/aimeri-todo/';
const EMAIL = 'test.aimeri.' + Date.now() + '@mailinator.com';
const PWD   = 'TestAimeri2024!';

(async () => {
  const browser = await chromium.launch({
    headless: false, slowMo: 350,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage();
  const dir  = 'C:/Users/AimeriCharon/Desktop/aimeri-todo/screenshots';
  require('fs').mkdirSync(dir, { recursive: true });
  const shot = async (n) => { await page.screenshot({ path: `${dir}/${n}.png` }); console.log('SHOT:' + n); };

  page.on('pageerror', e => console.log('JSERR:' + e.message));
  page.on('response', r => { if (r.url().includes('supabase') && r.status() >= 400) console.log('RESP:' + r.status() + ' ' + r.url().replace('https://rwsfkihoudtfobeiumrx.supabase.co','[SB]')); });

  const results = {};
  try {
    // ── 1. Load + signup ─────────────────────────────────────
    console.log('STEP:load ' + URL);
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 });
    await page.click('#signupTab');
    await page.fill('#signupEmail', EMAIL);
    await page.fill('#signupPwd', PWD);
    await page.click('#signupBtn');
    await page.waitForSelector('#appScreen.visible', { timeout: 10000 }).catch(() => {});
    results.login = await page.locator('#appScreen.visible').count() > 0;
    console.log('RESULT:LOGIN_' + (results.login ? 'OK' : 'FAIL'));
    if (!results.login) throw new Error('login failed: ' + (await page.locator('#authError').textContent().catch(()=>'')));

    // ── 2. Create task with rich text ────────────────────────
    console.log('STEP:create_task_richtext');
    await page.locator('.btn-add').click();
    await page.waitForTimeout(600);
    await page.fill('#mTitle', 'Tâche v2 · test complet');
    // Rich text body
    await page.locator('#mBody').click();
    await page.keyboard.type('Ligne de description avec du contenu recherchable.');
    // Expand → toolbar visible
    await page.locator('#expandBtn').click();
    await page.waitForTimeout(400);
    results.toolbarVisible = await page.locator('#rtToolbar').isVisible();
    console.log('toolbar_visible_when_expanded:' + results.toolbarVisible);
    // Bold a selection
    await page.locator('#mBody').click();
    await page.keyboard.press('Control+A');
    await page.locator('.rt-bold').click();
    await shot('v2_01_richtext');
    // Char counter present
    results.charCounter = (await page.locator('#charCounter').textContent()).includes('/');
    console.log('char_counter:' + await page.locator('#charCounter').textContent());

    // ── 3. Add a link resource ───────────────────────────────
    console.log('STEP:add_link');
    await page.locator('#addLinkBtn').click();
    await page.fill('#linkInput', 'https://www.wikipedia.org');
    await page.locator('.link-confirm').click();
    await page.waitForTimeout(500);
    results.linkAdded = await page.locator('.res-item').count() > 0;
    console.log('link_added:' + results.linkAdded + ' | res_counter:' + await page.locator('#resCounter').textContent());
    await shot('v2_02_link_added');

    // ── 4. Save the task ─────────────────────────────────────
    console.log('STEP:save_task');
    await page.locator('#modalSaveBtn').click();
    await page.waitForTimeout(2500);
    results.taskVisible = await page.locator('.card').filter({ hasText: 'test complet' }).count() > 0;
    results.chipVisible = await page.locator('.card').filter({ hasText: 'test complet' }).locator('.card-chip').count() > 0;
    console.log('RESULT:CREATE_' + (results.taskVisible ? 'OK' : 'FAIL') + ' | chip:' + results.chipVisible);
    await shot('v2_03_card_with_chip');

    // ── 5. Reopen → edit → auto-save ─────────────────────────
    console.log('STEP:edit_autosave');
    await page.locator('.card').filter({ hasText: 'test complet' }).click();
    await page.waitForTimeout(700);
    results.resourcePersisted = await page.locator('#resList .res-item').count() > 0;
    console.log('resource_persisted_on_reopen:' + results.resourcePersisted);
    // Modify title → expect autosave
    await page.fill('#mTitle', 'Tâche v2 · modifiée auto');
    await page.waitForTimeout(1600);
    const saveStatus = await page.locator('#saveStatus').textContent().catch(()=>'') || await page.locator('#saveStatus2').textContent().catch(()=>'');
    results.autosave = /Enregistré/.test(saveStatus);
    console.log('autosave_status:"' + saveStatus + '" => ' + (results.autosave ? 'OK' : 'FAIL'));
    await shot('v2_04_autosave');
    // Close (edit mode: button says Fermer)
    await page.locator('#modalSaveBtn').click();
    await page.waitForTimeout(1500);
    results.editPersisted = await page.locator('.card').filter({ hasText: 'modifiée auto' }).count() > 0;
    console.log('edit_persisted:' + results.editPersisted);

    // ── 6. Search in notes ───────────────────────────────────
    console.log('STEP:search_in_note');
    await page.locator('.card').filter({ hasText: 'modifiée auto' }).click();
    await page.waitForTimeout(600);
    await page.locator('#searchToggle').click();
    await page.fill('#searchInput', 'recherchable');
    await page.waitForTimeout(500);
    const searchCount = await page.locator('#searchCount').textContent();
    results.search = /\d\/\d/.test(searchCount) || searchCount === '1/1';
    console.log('search_count:"' + searchCount + '" => ' + (results.search ? 'OK' : 'CHECK'));
    await shot('v2_05_search');
    await page.locator('.rt-search-bar button[title="Fermer"]').click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);

    // ── 7. Refresh → session + data persist ──────────────────
    console.log('STEP:refresh');
    await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);
    results.refreshOk = await page.locator('#appScreen.visible').count() > 0
      && await page.locator('.loading-state').count() === 0
      && await page.locator('.card').filter({ hasText: 'modifiée auto' }).count() > 0;
    console.log('RESULT:REFRESH_' + (results.refreshOk ? 'OK' : 'FAIL'));
    await shot('v2_06_after_refresh');

    // ── 8. Cancel-confirmation for new task ──────────────────
    console.log('STEP:cancel_confirm');
    await page.locator('.btn-add').click();
    await page.waitForTimeout(500);
    await page.fill('#mTitle', 'Brouillon à annuler');
    // Click outside → confirm dialog
    await page.locator('#modalOverlay').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(500);
    results.confirmShown = await page.locator('#confirmOverlay.open').count() > 0;
    console.log('confirm_dialog_shown:' + results.confirmShown);
    await shot('v2_07_confirm');
    if (results.confirmShown) {
      await page.locator('.confirm-danger').click();
      await page.waitForTimeout(500);
    }

    // ── 9. Mark done + delete ────────────────────────────────
    console.log('STEP:complete_and_delete');
    const card = page.locator('.card').filter({ hasText: 'modifiée auto' }).first();
    await card.locator('.done-btn').click();
    await page.waitForTimeout(1200);
    await page.locator('#tab-done').click();
    await page.waitForTimeout(600);
    results.doneOk = await page.locator('#grid-done .card').filter({ hasText: 'modifiée auto' }).count() > 0;
    console.log('RESULT:DONE_' + (results.doneOk ? 'OK' : 'FAIL'));
    // Delete it
    await page.locator('#grid-done .card').filter({ hasText: 'modifiée auto' }).locator('.del-btn').click();
    await page.waitForTimeout(1500);
    results.deleteOk = await page.locator('#grid-done .card').filter({ hasText: 'modifiée auto' }).count() === 0;
    console.log('RESULT:DELETE_' + (results.deleteOk ? 'OK' : 'FAIL'));

    // ── 10. Logout ───────────────────────────────────────────
    console.log('STEP:logout');
    await page.locator('.btn-logout').click();
    await page.waitForTimeout(1500);
    results.logoutOk = await page.locator('#authScreen').isVisible();
    console.log('RESULT:LOGOUT_' + (results.logoutOk ? 'OK' : 'FAIL'));

  } catch (e) {
    console.log('ERROR:' + e.message);
    await page.screenshot({ path: `${dir}/v2_error.png` });
  }

  console.log('\n===== SUMMARY =====');
  console.log(JSON.stringify(results, null, 2));
  await page.waitForTimeout(1500);
  await browser.close();
})();
