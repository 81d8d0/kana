import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer, launchHeadlessChrome } from './test-helper.mjs';

test('E2E: Modal UX Enhancements (Backdrop, Escape, Focus, Stack, Promise Confirm, Scroll Lock)', async () => {
    const server = await createStaticServer(8205);
    const client = await launchHeadlessChrome(server.url, '/index.html');

    try {
        // Wait for page initialization
        await new Promise(r => setTimeout(r, 600));

        // 1. Test Backdrop click dismissal on index.html
        await client.evaluate(`document.getElementById('paste-btn').click()`);
        const pasteOpen = await client.evaluate(`getComputedStyle(document.getElementById('paste-modal')).display`);
        assert.notEqual(pasteOpen, 'none', 'Paste modal should open');

        // Simulate click starting and ending on backdrop
        await client.evaluate(`(() => {
            const modal = document.getElementById('paste-modal');
            modal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        })()`);
        await new Promise(r => setTimeout(r, 220));

        const pasteClosed = await client.evaluate(`getComputedStyle(document.getElementById('paste-modal')).display`);
        assert.equal(pasteClosed, 'none', 'Backdrop click should close paste modal');

        // 2. Test Anti-Accidental Dismissal during text selection drag
        await client.evaluate(`document.getElementById('edit-btn').click()`);
        const editOpen = await client.evaluate(`getComputedStyle(document.getElementById('edit-modal')).display`);
        assert.notEqual(editOpen, 'none');

        // Mousedown inside textarea, mouseup/click on backdrop
        await client.evaluate(`(() => {
            const textarea = document.getElementById('edit-textarea');
            const modal = document.getElementById('edit-modal');
            textarea.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        })()`);
        await new Promise(r => setTimeout(r, 100));

        const editStillOpen = await client.evaluate(`getComputedStyle(document.getElementById('edit-modal')).display`);
        assert.notEqual(editStillOpen, 'none', 'Modal should NOT dismiss when mouse drag originates inside textarea');

        // Close edit modal with Cancel
        await client.evaluate(`document.getElementById('cancel-edit-btn').click()`);
        await new Promise(r => setTimeout(r, 220));

        // 3. Test Escape Key dismissal
        await client.evaluate(`document.getElementById('all-keys-btn').click()`);
        const allKeysOpen = await client.evaluate(`getComputedStyle(document.getElementById('all-keys-modal')).display`);
        assert.notEqual(allKeysOpen, 'none');

        await client.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        await new Promise(r => setTimeout(r, 220));

        const allKeysClosed = await client.evaluate(`getComputedStyle(document.getElementById('all-keys-modal')).display`);
        assert.equal(allKeysClosed, 'none', 'Escape key should close all-keys modal');

        // 4. Test Multi-Level Modal Stacking & Escape Order
        // Open History modal (stack depth 1)
        await client.evaluate(`document.getElementById('history-btn').click()`);
        const historyOpen = await client.evaluate(`getComputedStyle(document.getElementById('history-modal')).display`);
        assert.notEqual(historyOpen, 'none');

        // Open Confirm dialog (stack depth 2)
        await client.evaluate(`document.getElementById('clear-history-btn').click()`);
        const confirmOpen = await client.evaluate(`getComputedStyle(document.getElementById('custom-confirm-modal')).display`);
        assert.notEqual(confirmOpen, 'none', 'Confirm modal should be open on top of history modal');

        // First Escape: closes confirm modal only
        await client.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        await new Promise(r => setTimeout(r, 220));

        const confirmClosed = await client.evaluate(`getComputedStyle(document.getElementById('custom-confirm-modal')).display`);
        const historyStillOpen = await client.evaluate(`getComputedStyle(document.getElementById('history-modal')).display`);
        assert.equal(confirmClosed, 'none', 'First Escape should close topmost Confirm modal');
        assert.notEqual(historyStillOpen, 'none', 'History modal should remain open after top modal closes');

        // Second Escape: closes history modal
        await client.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        await new Promise(r => setTimeout(r, 220));

        const historyClosed = await client.evaluate(`getComputedStyle(document.getElementById('history-modal')).display`);
        assert.equal(historyClosed, 'none', 'Second Escape should close history modal');

        // 5. Test Focus Restoration to #kana-input after all modals close
        await new Promise(r => setTimeout(r, 350));
        const isInputFocused = await client.evaluate(`document.activeElement === document.getElementById('kana-input')`);
        assert.ok(isInputFocused, 'Input field should automatically regain focus after all modals close');

        // 6. Test Backdrop Touch Action / Scroll Lock styles
        const scrollLockStyles = await client.evaluate(`(() => {
            const modal = document.querySelector('.modal');
            const style = getComputedStyle(modal);
            return {
                touchAction: style.touchAction,
                overscrollBehavior: style.overscrollBehaviorY || style.overscrollBehavior
            };
        })()`);
        assert.equal(scrollLockStyles.touchAction, 'none', 'Modal backdrop should have touch-action: none');
        assert.equal(scrollLockStyles.overscrollBehavior, 'contain', 'Modal backdrop should have overscroll-behavior: contain');

        // 7. Test LINE Mode Modal UX & Promise Confirm in line.html
        await client.evaluate(`window.location.href = 'line.html'`);
        await new Promise(r => setTimeout(r, 1400));

        // Open paste modal via menu
        await client.evaluate(`document.getElementById('menu-paste').click()`);
        const linePasteOpen = await client.evaluate(`getComputedStyle(document.getElementById('paste-modal')).display`);
        assert.notEqual(linePasteOpen, 'none', 'LINE mode paste modal should open');

        // Close via Escape
        await client.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        await new Promise(r => setTimeout(r, 350));

        const linePasteClosed = await client.evaluate(`getComputedStyle(document.getElementById('paste-modal')).display`);
        assert.equal(linePasteClosed, 'none', 'LINE mode Escape should close paste modal');

        // Verify focus returned to line input
        const isLineInputFocused = await client.evaluate(`document.activeElement === document.getElementById('kana-input')`);
        assert.ok(isLineInputFocused, 'LINE mode kana-input should regain focus');

        // Test Promise resolution of UiFeedback.confirm
        const confirmPromiseResultOk = await client.evaluate(`(() => {
            const p = UiFeedback.confirm('テスト確認OK');
            document.getElementById('confirm-modal-ok-btn').click();
            return p;
        })()`);
        assert.equal(confirmPromiseResultOk, true, 'UiFeedback.confirm should resolve true on OK');
        await new Promise(r => setTimeout(r, 300));

        const confirmPromiseResultCancel = await client.evaluate(`(() => {
            const p = UiFeedback.confirm('テスト確認Cancel');
            document.getElementById('confirm-modal-cancel-btn').click();
            return p;
        })()`);
        assert.equal(confirmPromiseResultCancel, false, 'UiFeedback.confirm should resolve false on Cancel');
        await new Promise(r => setTimeout(r, 300));

    } finally {
        await client.close();
        await server.close();
    }
});
