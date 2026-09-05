import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFromHtml } from './test-helper.mjs';

const KanaMatcher = extractFromHtml(
    'index.html',
    /const KanaMatcher = \(\(\) => \{[\s\S]*?\}\)\(\);/,
    'KanaMatcher'
);

test('KanaMatcher: Basic Hiragana input matching', () => {
    assert.equal(KanaMatcher.classify('あ', 'あ'), 'correct');
    assert.equal(KanaMatcher.classify('か', 'か'), 'correct');
    assert.equal(KanaMatcher.classify('さ', 'さ'), 'correct');
    assert.equal(KanaMatcher.classify('ん', 'ん'), 'correct');
});

test('KanaMatcher: Katakana target with Hiragana input returns correct-kata', () => {
    assert.equal(KanaMatcher.classify('ア', 'あ'), 'correct-kata');
    assert.equal(KanaMatcher.classify('カ', 'か'), 'correct-kata');
    assert.equal(KanaMatcher.classify('サ', 'さ'), 'correct-kata');
    assert.equal(KanaMatcher.classify('ン', 'ん'), 'correct-kata');
});

test('KanaMatcher: Katakana target with Katakana input returns correct', () => {
    assert.equal(KanaMatcher.classify('ア', 'ア'), 'correct');
    assert.equal(KanaMatcher.classify('カ', 'カ'), 'correct');
    assert.equal(KanaMatcher.classify('サ', 'サ'), 'correct');
});

test('KanaMatcher: Prolonged sound mark (ー) variants', () => {
    assert.equal(KanaMatcher.classify('ー', 'ー'), 'correct');
    assert.equal(KanaMatcher.classify('ー', '-'), 'correct');
    assert.equal(KanaMatcher.classify('ー', '－'), 'correct');
    assert.equal(KanaMatcher.classify('ー', 'ｰ'), 'correct');
    
    // In katakana context with hiragana input
    assert.equal(KanaMatcher.classify('ー', 'ー', 'コ', 'こ'), 'correct-kata');
    assert.equal(KanaMatcher.classify('ー', 'ー', 'こ', 'こ'), 'correct');
});

test('KanaMatcher: Voiced and semi-voiced kana pending states', () => {
    // が <- か
    assert.equal(KanaMatcher.classify('が', 'か'), 'pending');
    // ぎ <- き
    assert.equal(KanaMatcher.classify('ぎ', 'き'), 'pending');
    // ば <- は
    assert.equal(KanaMatcher.classify('ば', 'は'), 'pending');
    // ぱ <- は, ば
    assert.equal(KanaMatcher.classify('ぱ', 'は'), 'pending');
    assert.equal(KanaMatcher.classify('ぱ', 'ば'), 'pending');
    // ゔ <- う
    assert.equal(KanaMatcher.classify('ゔ', 'う'), 'pending');
    // Katakana variants
    assert.equal(KanaMatcher.classify('ガ', 'カ'), 'pending');
    assert.equal(KanaMatcher.classify('ポ', 'ホ'), 'pending');
});

test('KanaMatcher: Small kana (拗音・促音) pending states', () => {
    assert.equal(KanaMatcher.classify('ぁ', 'あ'), 'pending');
    assert.equal(KanaMatcher.classify('っ', 'つ'), 'pending');
    assert.equal(KanaMatcher.classify('ゃ', 'や'), 'pending');
    assert.equal(KanaMatcher.classify('ゅ', 'ゆ'), 'pending');
    assert.equal(KanaMatcher.classify('ょ', 'よ'), 'pending');
    assert.equal(KanaMatcher.classify('ゎ', 'わ'), 'pending');
});

test('KanaMatcher: Romaji input pending state for IME composition', () => {
    assert.equal(KanaMatcher.classify('あ', 'a'), 'pending');
    assert.equal(KanaMatcher.classify('か', 'k'), 'pending');
    assert.equal(KanaMatcher.classify('さ', 's'), 'pending');
});

test('KanaMatcher: Mistakes and invalid inputs return error', () => {
    assert.equal(KanaMatcher.classify('あ', 'い'), 'error');
    assert.equal(KanaMatcher.classify('か', 'さ'), 'error');
    assert.equal(KanaMatcher.classify('ん', 'ま'), 'error');
    assert.equal(KanaMatcher.classify('つ', 'っ'), 'error');
});
