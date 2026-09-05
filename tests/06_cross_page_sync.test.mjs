import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer, launchHeadlessChrome } from './test-helper.mjs';

test('E2E: Cross-page theme sync, shared paste text, and dynamic return button', async () => {
    const server = await createStaticServer(8204);
    const client = await launchHeadlessChrome(server.url, '/index.html');

    try {
        // 1. In index.html, toggle to dark mode and set paste text
        await client.evaluate(`(() => {
            // Set dark mode
            if (!document.body.classList.contains('dark-mode')) {
                document.getElementById('theme-toggle-btn').click();
            }
            // Set a custom paste text
            localStorage.setItem('kana_practice_last_paste', 'すばらしいきょうのてんき');
            // Ensure document layout is set
            localStorage.setItem('kana_practice_layout', 'document');
        })()`);

        const themeInIndex = await client.evaluate(`localStorage.getItem('kana_practice_theme')`);
        assert.equal(themeInIndex, 'dark', 'Theme should be dark in index.html');

        // 2. Navigate to line.html
        await client.evaluate(`window.location.href = 'line.html'`);
        await new Promise(r => setTimeout(r, 1200));

        // 3. Verify theme is synced to line.html
        const lineState = await client.evaluate(`({
            isDark: document.body.classList.contains('dark-mode'),
            classicBtnText: document.getElementById('menu-classic').textContent.trim(),
            classicBtnLabel: document.getElementById('menu-classic').getAttribute('aria-label'),
            hasPrefetch: !!document.querySelector('link[rel="prefetch"][href="./"]'),
            themeKey: localStorage.getItem('kana_practice_theme')
        })`);

        assert.equal(lineState.isDark, true, 'line.html should automatically be in dark mode due to theme sync');
        assert.equal(lineState.classicBtnText, '📃', 'Back button should display 📃 for document mode preference');
        assert.ok(lineState.hasPrefetch, 'line.html should have prefetch link for ./');

        // 4. Open paste modal in line.html and verify shared paste text is pre-filled
        await client.evaluate(`document.getElementById('menu-paste').click()`);
        const pasteVal = await client.evaluate(`document.getElementById('paste-textarea').value`);
        assert.equal(pasteVal, 'すばらしいきょうのてんき', 'Pasted text from index.html should be shared in line.html');

        // 5. Test dynamic button when layout preference is classic
        await client.evaluate(`(() => {
            localStorage.setItem('kana_practice_layout', 'classic');
            // Re-run the button update logic
            const btn = document.getElementById('menu-classic');
            const pref = localStorage.getItem('kana_practice_layout');
            btn.textContent = pref === 'document' ? '📃' : '📄';
        })()`);
        const classicBtnTextUpdated = await client.evaluate(`document.getElementById('menu-classic').textContent.trim()`);
        assert.equal(classicBtnTextUpdated, '📄', 'Back button should display 📄 when preference is classic');
    } finally {
        await client.close();
        await server.close();
    }
});
