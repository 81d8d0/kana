import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer, launchHeadlessChrome } from './test-helper.mjs';

test('E2E: Modals open/close behaviors and dark mode toggle', async () => {
    const server = await createStaticServer(8202);
    const client = await launchHeadlessChrome(server.url, '/index.html');

    try {
        // 1. Test Dark Mode Toggle
        const isDarkBefore = await client.evaluate(`document.body.classList.contains('dark-mode')`);
        await client.evaluate(`document.getElementById('theme-toggle-btn').click()`);
        const isDarkAfter = await client.evaluate(`document.body.classList.contains('dark-mode')`);
        assert.notEqual(isDarkBefore, isDarkAfter, 'Theme should toggle on click');

        const savedTheme = await client.evaluate(`localStorage.getItem('kana_practice_theme')`);
        assert.equal(savedTheme, isDarkAfter ? 'dark' : 'light');

        // Toggle back
        await client.evaluate(`document.getElementById('theme-toggle-btn').click()`);

        // 2. Test History Modal Open and Close
        await client.evaluate(`document.getElementById('history-btn').click()`);
        const historyDisplayOpen = await client.evaluate(`getComputedStyle(document.getElementById('history-modal')).display`);
        assert.notEqual(historyDisplayOpen, 'none', 'History modal should be visible when opened');

        await client.evaluate(`document.getElementById('close-history-btn').click()`);
        const historyDisplayClosed = await client.evaluate(`getComputedStyle(document.getElementById('history-modal')).display`);
        assert.equal(historyDisplayClosed, 'none', 'History modal should be hidden when closed');

        // 3. Test Edit Pool Modal
        await client.evaluate(`document.getElementById('edit-btn').click()`);
        const editModalState = await client.evaluate(`({
            display: getComputedStyle(document.getElementById('edit-modal')).display,
            textareaVal: document.getElementById('edit-textarea').value
        })`);
        assert.notEqual(editModalState.display, 'none');
        assert.ok(editModalState.textareaVal.length > 0, 'Edit modal textarea should be populated with current phrases');

        await client.evaluate(`document.getElementById('cancel-edit-btn').click()`);
        const editDisplayClosed = await client.evaluate(`getComputedStyle(document.getElementById('edit-modal')).display`);
        assert.equal(editDisplayClosed, 'none');

        // 4. Test Paste Modal
        await client.evaluate(`document.getElementById('paste-btn').click()`);
        const pasteDisplayOpen = await client.evaluate(`getComputedStyle(document.getElementById('paste-modal')).display`);
        assert.notEqual(pasteDisplayOpen, 'none');

        await client.evaluate(`document.getElementById('cancel-paste-btn').click()`);
        const pasteDisplayClosed = await client.evaluate(`getComputedStyle(document.getElementById('paste-modal')).display`);
        assert.equal(pasteDisplayClosed, 'none');

        // 5. Test All-Keys Modal
        await client.evaluate(`document.getElementById('all-keys-btn').click()`);
        const allKeysDisplayOpen = await client.evaluate(`getComputedStyle(document.getElementById('all-keys-modal')).display`);
        assert.notEqual(allKeysDisplayOpen, 'none');

        // Click a category (Hiragana)
        await client.evaluate(`document.getElementById('all-keys-hiragana-btn').click()`);
        await new Promise(r => setTimeout(r, 200));
        const allKeysDisplayClosed = await client.evaluate(`getComputedStyle(document.getElementById('all-keys-modal')).display`);
        assert.equal(allKeysDisplayClosed, 'none', 'All Keys modal should close after selecting a category');

        const articleCharsCount = await client.evaluate(`document.querySelectorAll('.char-wrapper').length`);
        assert.ok(articleCharsCount > 30, 'Selecting all keys should populate a comprehensive practice text');
    } finally {
        await client.close();
        await server.close();
    }
});
