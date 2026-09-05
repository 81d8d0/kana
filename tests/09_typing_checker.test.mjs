import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure mock localStorage exists in Node.js test environment
if (!globalThis.localStorage) {
    const memStorage = new Map();
    globalThis.localStorage = {
        getItem: (key) => memStorage.has(key) ? memStorage.get(key) : null,
        setItem: (key, val) => memStorage.set(key, String(val)),
        removeItem: (key) => memStorage.delete(key),
        clear: () => memStorage.clear()
    };
}

await import('../kana-core.js');
const { findChromeExecutable } = await import('./test-helper.mjs');

const { TypingChecker, SafeStorage, isTestableKana, DEFAULT_POOL } = globalThis;

test('TypingChecker: isTestableKana detects Japanese kana and marks', () => {
    assert.equal(isTestableKana('あ'), true);
    assert.equal(isTestableKana('ア'), true);
    assert.equal(isTestableKana('ー'), true);
    assert.equal(isTestableKana('、'), true);
    assert.equal(isTestableKana('。'), true);
    assert.equal(isTestableKana('？'), true);
    assert.equal(isTestableKana('！'), true);
    assert.equal(isTestableKana('a'), false);
    assert.equal(isTestableKana('1'), false);
    assert.equal(isTestableKana('漢'), false);
});

test('TypingChecker: Session matching & status array generation', () => {
    const checker = new TypingChecker('あいうえお', { mode: 'document' });
    assert.equal(checker.totalTestableCount, 5);

    // 1. Partial correct input
    const res1 = checker.check('あい');
    assert.equal(res1.hasError, false);
    assert.equal(res1.allCorrect, true);
    assert.equal(res1.isComplete, false);
    assert.equal(res1.statuses[0], 'correct');
    assert.equal(res1.statuses[1], 'correct');
    assert.equal(res1.statuses[2], undefined);
    assert.equal(checker.cumulativeMistakes, 0);

    // 2. Typing error
    const res2 = checker.check('あいえ');
    assert.equal(res2.hasError, true);
    assert.equal(res2.allCorrect, false);
    assert.equal(res2.statuses[2], 'error');
    assert.equal(checker.cumulativeMistakes, 1);

    // 3. Backspacing and fixing the error
    const res3 = checker.check('あい');
    assert.equal(res3.hasError, false);
    assert.equal(checker.cumulativeMistakes, 1, 'Fixing does not decrease cumulative mistakes');

    const res4 = checker.check('あいう');
    assert.equal(res4.hasError, false);
    assert.equal(res4.statuses[2], 'correct');
    assert.equal(checker.cumulativeMistakes, 1, 'Typing correct char does not increase mistake');
});

test('TypingChecker: IME composition protection prevents false mistake accumulation', () => {
    const checker = new TypingChecker('かきくけこ', { mode: 'document' });

    // During IME composition, user types romaji 'k', which is pending
    const resComp1 = checker.check('k', { isComposing: true });
    assert.equal(checker.cumulativeMistakes, 0);

    // User types invalid kana 'さ' during composition
    const resComp2 = checker.check('さ', { isComposing: true });
    assert.equal(resComp2.hasError, true);
    assert.equal(checker.cumulativeMistakes, 0, 'Mistakes must not increment while isComposing is true');

    // User finishes composition with 'か'
    const resCompEnd = checker.check('か', { isComposing: false });
    assert.equal(resCompEnd.hasError, false);
    assert.equal(resCompEnd.statuses[0], 'correct');
    assert.equal(checker.cumulativeMistakes, 0);
});

test('TypingChecker: Mode-specific completion conditions', () => {
    // 1. LINE mode: completes when inputChars.length >= targetChars.length
    const lineChecker = new TypingChecker('こんにちは', { mode: 'line' });
    assert.equal(lineChecker.check('こんにち').isComplete, false);
    assert.equal(lineChecker.check('こんにちは').isComplete, true);
    assert.equal(lineChecker.check('こんにちは！').isComplete, true);

    // 2. Classic mode: requires all correct or exact match
    const classicChecker = new TypingChecker('さくら', { mode: 'classic' });
    assert.equal(classicChecker.check('さくら').isComplete, true);
    assert.equal(classicChecker.check('さくろ').isComplete, false, 'Classic mode rejects completion with errors');

    // 3. Document mode: allows overflow completion or full match
    const docChecker = new TypingChecker('ねこ', { mode: 'document' });
    assert.equal(docChecker.check('ねこ').isComplete, true);
    assert.equal(docChecker.check('ねいぬ').isComplete, true, 'Document mode completes if length exceeded');
});

test('TypingChecker: Input overflow accumulates mistake count', () => {
    const checker = new TypingChecker('やま', { mode: 'document' });
    checker.check('やま');
    assert.equal(checker.cumulativeMistakes, 0);

    checker.check('やまかわ'); // 2 chars over length
    assert.equal(checker.cumulativeMistakes, 2);
});

test('SafeStorage.loadPool: Recovers gracefully from corrupted JSON and empty keys', () => {
    const TEST_KEY = 'kana_test_corrupted_pool_key';

    // Corrupted JSON string
    SafeStorage.set(TEST_KEY, '{{corrupt-json-12345');
    const pool1 = SafeStorage.loadPool(TEST_KEY, DEFAULT_POOL);
    assert.ok(Array.isArray(pool1) && pool1.length > 0, 'Should safely fallback to default pool on corrupt JSON');
    assert.deepEqual(pool1, DEFAULT_POOL);

    // Empty array in storage
    SafeStorage.set(TEST_KEY, '[]');
    const pool2 = SafeStorage.loadPool(TEST_KEY, DEFAULT_POOL);
    assert.deepEqual(pool2, DEFAULT_POOL, 'Should fallback on empty array');

    // Valid array
    SafeStorage.set(TEST_KEY, JSON.stringify(['テスト1', 'テスト2']));
    const pool3 = SafeStorage.loadPool(TEST_KEY, DEFAULT_POOL);
    assert.deepEqual(pool3, ['テスト1', 'テスト2']);

    SafeStorage.remove(TEST_KEY);
});

test('test-helper: findChromeExecutable resolves valid string', () => {
    const execPath = findChromeExecutable();
    assert.ok(typeof execPath === 'string' && execPath.length > 0, 'Should find executable string');
});
