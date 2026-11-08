// Browser verification against the running development demo. Saves two what-if
// assessments but cancels incident creation, leaving operational faults unchanged.
// Usage: node scripts/verify_what_if.cjs <path-to-playwright-package> [base-url]
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.argv[3] || 'http://127.0.0.1:5188/', { waitUntil: 'networkidle' });
    const lab = page.locator('#what-if');
    const runButton = lab.getByRole('button', { name: 'Run failure assessment', exact: true });
    await runButton.waitFor();
    await page.waitForFunction(() => !document.querySelector('#what-if select')?.disabled, { timeout: 30000 });
    await lab.getByRole('button', { name: 'Primary chiller / backup available', exact: true }).click();
    await runButton.click();
    await lab.getByRole('heading', { name: 'Primary Chiller unavailable', exact: true }).waitFor({ timeout: 20000 });
    await lab.getByText('Requirement retained through Backup Chiller.', { exact: true }).waitFor();
    await lab.getByRole('button', { name: 'Shared cooling pump', exact: true }).click();
    await runButton.click();
    await lab.getByRole('heading', { name: 'Chilled Water Pump unavailable', exact: true }).waitFor({ timeout: 20000 });
    await lab.getByText('$29,000', { exact: true }).waitFor();
    await lab.locator('input[type=range]').fill('15');
    await lab.getByText('$7,250 potential exposure', { exact: true }).waitFor();
    await lab.getByRole('heading', { name: 'How to respond properly', exact: true }).waitFor();
    await lab.getByRole('heading', { name: 'Verify recovery before closing', exact: true }).waitFor();
    assert.match(await lab.innerText(), /A second chiller does not bypass the shared pump/);
    await lab.getByRole('button', { name: 'Copy response brief', exact: true }).click();
    await lab.getByText('Response brief copied. Share it through your approved team channel.', { exact: true }).waitFor();
    const startResponse = lab.getByRole('button', { name: 'Start simulated response…', exact: true });
    if (await startResponse.count()) {
      await startResponse.click();
      await lab.getByRole('button', { name: 'Create simulated incident + work order', exact: true }).waitFor();
      await lab.getByRole('button', { name: 'Cancel', exact: true }).click();
    } else {
      await lab.getByText('Open response recorded for this asset', { exact: true }).waitFor();
    }
    await page.reload({ waitUntil: 'networkidle' });
    await lab.getByRole('heading', { name: 'Chilled Water Pump unavailable', exact: true }).waitFor({ timeout: 20000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await lab.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Mobile document should not overflow horizontally');
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'domino-what-if-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await lab.scrollIntoViewIfNeeded();
    await lab.screenshot({ path: path.join(process.env.TEMP || '.', 'domino-what-if-desktop.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: persisted chiller and pump assessments, backup explanation, $29,000/hour / $7,250 at 15 minutes, response checklist and copy, confirmation/cancel or existing response, refresh persistence, mobile width, no runtime errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
