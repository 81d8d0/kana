import test from 'node:test';
import assert from 'node:assert/strict';

// Create a mock localStorage for testing HistoryStore
const mockStorage = new Map();
const mockLocalStorage = {
    getItem: (key) => mockStorage.has(key) ? mockStorage.get(key) : null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear()
};

globalThis.localStorage = mockLocalStorage;

await import('../kana-core.js');
const { HistoryStore, DEFAULT_POOL, ALL_KEYS_GROUPS } = globalThis;

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
    assert.ok(Array.isArray(DEFAULT_POOL));
    assert.ok(DEFAULT_POOL.length >= 10, 'Pool should have at least 10 practice sentences');
    for (const sentence of DEFAULT_POOL) {
        assert.ok(typeof sentence === 'string' && sentence.length > 0);
        assert.ok(!/[\r\n\t]/.test(sentence));
    }

    assert.ok(Array.isArray(ALL_KEYS_GROUPS));
    assert.equal(ALL_KEYS_GROUPS.length, 4, 'Should have 4 groups (hiragana, katakana, youon, gairai)');
    for (const group of ALL_KEYS_GROUPS) {
        assert.ok(typeof group === 'string' && group.length > 0);
    }
});
