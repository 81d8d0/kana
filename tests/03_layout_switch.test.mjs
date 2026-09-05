import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer, launchHeadlessChrome } from './test-helper.mjs';

test('E2E: Document ↔ Classic layout switch preserves typing state and progress', async () => {
    const server = await createStaticServer(8201);
    const client = await launchHeadlessChrome(server.url, '/index.html');

    try {
        // Wait for DOM to be ready
        for (let i = 0; i < 30; i++) {
            const ready = await client.evaluate(`document.querySelectorAll(".char-wrapper .char-target").length >= 4`);
            if (ready) break;
            await new Promise(r => setTimeout(r, 50));
        }

        // 1. Check initial state
        const initial = await client.evaluate(`({
            bodyClass: document.body.className,
            toggleText: document.getElementById('layout-toggle-btn').textContent,
            progressText: document.getElementById('progress').textContent
        })`);
        assert.ok(initial.bodyClass.includes('layout-document') || initial.bodyClass.includes('layout-classic'));

        // 2. Type 4 matching characters
        const typeResult = await client.evaluate(`(() => {
            const input = document.getElementById('kana-input');
            const spans = document.querySelectorAll('.char-wrapper .char-target');
            const typed = spans[0].textContent + spans[1].textContent + spans[2].textContent + spans[3].textContent;
            input.value = typed;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return {
                typed,
                progress: document.getElementById('progress').textContent,
                inputValue: input.value,
                inputSpansCount: document.querySelectorAll('.char-wrapper.has-input').length
            };
        })()`);

        assert.equal(typeResult.inputValue, typeResult.typed);
        assert.equal(typeResult.inputSpansCount, 4);
        assert.ok(typeResult.progress.startsWith('4 /'));

        // 3. Click layout toggle button
        await client.evaluate(`document.getElementById('layout-toggle-btn').click()`);
        await new Promise(r => setTimeout(r, 450));

        // 4. Assert state after first toggle
        const afterFirstToggle = await client.evaluate(`(() => {
            const input = document.getElementById('kana-input');
            return {
                bodyClass: document.body.className,
                toggleText: document.getElementById('layout-toggle-btn').textContent,
                inputValue: input.value,
                progress: document.getElementById('progress').textContent,
                inputSpansCount: document.querySelectorAll('.char-wrapper.has-input').length,
                storedLayout: localStorage.getItem('kana_practice_layout')
            };
        })()`);

        assert.notEqual(afterFirstToggle.toggleText, initial.toggleText, 'Toggle button icon should change');
        assert.equal(afterFirstToggle.inputValue, typeResult.typed, 'Input value MUST be preserved');
        assert.equal(afterFirstToggle.progress, typeResult.progress, 'Progress count MUST be preserved');
        assert.equal(afterFirstToggle.inputSpansCount, 4, 'Active character markup MUST be preserved');
        assert.ok(afterFirstToggle.storedLayout, 'Layout preference must be persisted to localStorage');

        // 5. Toggle back in the opposite direction
        await client.evaluate(`document.getElementById('layout-toggle-btn').click()`);
        await new Promise(r => setTimeout(r, 450));

        // 6. Assert state after second toggle
        const afterSecondToggle = await client.evaluate(`(() => {
            const input = document.getElementById('kana-input');
            return {
                bodyClass: document.body.className,
                toggleText: document.getElementById('layout-toggle-btn').textContent,
                inputValue: input.value,
                progress: document.getElementById('progress').textContent,
                inputSpansCount: document.querySelectorAll('.char-wrapper.has-input').length
            };
        })()`);

        assert.equal(afterSecondToggle.toggleText, initial.toggleText, 'Should be back to initial button icon');
        assert.equal(afterSecondToggle.inputValue, typeResult.typed, 'Input value MUST still be preserved');
        assert.equal(afterSecondToggle.progress, typeResult.progress, 'Progress MUST still be preserved');
        assert.equal(afterSecondToggle.inputSpansCount, 4, 'Spans MUST still be preserved');
    } finally {
        await client.close();
        await server.close();
    }
});
