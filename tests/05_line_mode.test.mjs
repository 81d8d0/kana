import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer, launchHeadlessChrome } from './test-helper.mjs';

test('E2E: LINE mode (line.html) chat interface and interactions', async () => {
    const server = await createStaticServer(8203);
    const client = await launchHeadlessChrome(server.url, '/line.html');

    try {
        // Wait for window.onload and PracticeEngine.init() to complete
        await new Promise(r => setTimeout(r, 1200));

        // 1. Verify chat area and initial messages render
        const initial = await client.evaluate(`({
            hasChatArea: !!document.getElementById('chat-area'),
            hasInput: !!document.getElementById('kana-input'),
            hasClassicBtn: !!document.getElementById('menu-classic'),
            hasHamburgerBtn: !!document.getElementById('hamburger-btn'),
            bubbleCount: document.querySelectorAll('.chat-bubble').length
        })`);

        assert.ok(initial.hasChatArea, 'Chat area must exist');
        assert.ok(initial.hasInput, 'Kana input must exist');
        assert.ok(initial.hasClassicBtn, 'Return to classic mode button must exist');
        assert.ok(initial.hasHamburgerBtn, 'Hamburger menu button must exist');
        assert.ok(initial.bubbleCount > 0, 'Initial chat bubbles should be rendered');

        // 2. Test Hamburger Menu Toggle
        const menuDisplayBefore = await client.evaluate(`document.getElementById('hamburger-menu').style.display`);
        assert.notEqual(menuDisplayBefore, 'flex');

        await client.evaluate(`document.getElementById('hamburger-btn').click()`);
        const menuDisplayAfter = await client.evaluate(`document.getElementById('hamburger-menu').style.display`);
        assert.equal(menuDisplayAfter, 'flex', 'Hamburger menu should open on click');

        // Close menu by clicking outside
        await client.evaluate(`document.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
        const menuDisplayClosed = await client.evaluate(`document.getElementById('hamburger-menu').style.display`);
        assert.equal(menuDisplayClosed, 'none', 'Clicking outside should close hamburger menu');

        // 3. Test Return to Standard Mode button configuration
        const backToStandardButtonAction = await client.evaluate(`(() => {
            const btn = document.getElementById('menu-classic');
            return {
                text: btn.textContent,
                onclickDefined: typeof btn.onclick === 'function'
            };
        })()`);
        assert.ok(backToStandardButtonAction.onclickDefined, 'Back button must have onclick navigation handler');
    } finally {
        await client.close();
        await server.close();
    }
});
