import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFromHtml } from './test-helper.mjs';

// Create a mock localStorage for testing HistoryStore
const mockStorage = new Map();
const mockLocalStorage = {
    getItem: (key) => mockStorage.has(key) ? mockStorage.get(key) : null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear()
};

const HistoryStore = extractFromHtml(
    'index.html',
    /const HistoryStore = \(\(\) => \{[\s\S]*?\}\)\(\);/,
    'HistoryStore',
    { localStorage: mockLocalStorage }
);

test('HistoryStore: save record and respect MAX_RECORDS (200)', () => {
    mockStorage.clear();
    HistoryStore.save('250 文字数/分');
    const records = HistoryStore.load();
    assert.equal(records.length, 1);
    assert.equal(records[0].cpm, '250 文字数/分');
    assert.ok(typeof records[0].date === 'string' && records[0].date.length > 0);

    // Save over 205 records
    for (let i = 0; i < 205; i++) {
        HistoryStore.save(`cpm-${i}`);
    }
    const cappedRecords = HistoryStore.load();
    assert.equal(cappedRecords.length, 200);
    assert.equal(cappedRecords[0].cpm, 'cpm-204');
});

test('HistoryStore: clear records removes all entries', () => {
    HistoryStore.save('120 文字数/分');
    assert.ok(HistoryStore.load().length > 0);
    HistoryStore.clear();
    assert.equal(HistoryStore.load().length, 0);
});

test('HistoryStore: JSON import validation', () => {
    mockStorage.clear();
    
    // Valid import
    const validJson = JSON.stringify([
        { date: '2026/09/01 10:00', cpm: '300 文字数/分' },
        { date: '2026/09/02 11:30', cpm: '350 文字数/分' }
    ]);
    HistoryStore.importFromJson(validJson);
    assert.equal(HistoryStore.load().length, 2);

    // Invalid imports should throw
    assert.throws(() => HistoryStore.importFromJson('not-json'));
    assert.throws(() => HistoryStore.importFromJson(JSON.stringify({ not: 'an-array' })));
    assert.throws(() => HistoryStore.importFromJson(JSON.stringify([{ invalid: 'record' }])));
    assert.throws(() => HistoryStore.importFromJson(JSON.stringify([])));
});

test('Sentence Pool & All Keys groups data integrity', () => {
    const poolModule = extractFromHtml(
        'index.html',
        /const DEFAULT_SENTENCE_POOL = \[[\s\S]*?\];/,
        'DEFAULT_SENTENCE_POOL'
    );
    assert.ok(Array.isArray(poolModule));
    assert.ok(poolModule.length >= 10, 'Pool should have at least 10 practice sentences');
    for (const sentence of poolModule) {
        assert.ok(typeof sentence === 'string' && sentence.length > 0);
        assert.ok(!/[\r\n\t]/.test(sentence));
    }

    const allKeysModule = extractFromHtml(
        'index.html',
        /const ALL_KEYS_GROUPS = \[[\s\S]*?\];/,
        'ALL_KEYS_GROUPS'
    );
    assert.ok(Array.isArray(allKeysModule));
    assert.equal(allKeysModule.length, 4, 'Should have 4 groups (hiragana, katakana, youon, gairai)');
    for (const group of allKeysModule) {
        assert.ok(typeof group === 'string' && group.length > 0);
    }
});
