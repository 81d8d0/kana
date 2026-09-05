/**
 * KanaType Core Logic & Data Module
 * Shared between index.html, line.html, and automated test suites.
 */
(function (global) {
    'use strict';

    // Helper to get localStorage across browser and node test environments
    function getStorage() {
        if (typeof localStorage !== 'undefined') return localStorage;
        if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
        if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
        return null;
    }

    // 1. SafeStorage: resilient localStorage wrapper
    const SafeStorage = {
        get(key, fallback = null) {
            try {
                const s = getStorage();
                if (!s) return fallback;
                const v = s.getItem(key);
                return v === null ? fallback : v;
            } catch (err) {
                return fallback;
            }
        },
        set(key, value) {
            try {
                const s = getStorage();
                if (!s) return false;
                s.setItem(key, value);
                return true;
            } catch (err) {
                return false;
            }
        },
        remove(key) {
            try {
                const s = getStorage();
                if (!s) return false;
                s.removeItem(key);
                return true;
            } catch (err) {
                return false;
            }
        }
    };

    // 2. Utility functions
    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function retrySequence(fn, delays = [0, 50, 150, 300, 500]) {
        delays.forEach(d => setTimeout(fn, d));
    }

    // 3. KanaMatcher: Japanese flick input classification engine
    const KanaMatcher = (() => {
        const isKatakana = (ch) => /[\u30A0-\u30FF]/.test(ch);
        const isHiragana = (ch) => /[\u3040-\u309F]/.test(ch);
        const isProlongedMark = (ch) => ch === 'ー';
        const isProlongedInput = (ch) => ch === 'ー' || ch === '-' || ch === '－' || ch === 'ｰ';

        const pendingMap = {
            'ぁ':'あ', 'ぃ':'い', 'ぅ':'う', 'ぇ':'え', 'ぉ':'お',
            'が':'か', 'ぎ':'き', 'ぐ':'く', 'げ':'け', 'ご':'こ',
            'ざ':'さ', 'じ':'し', 'ず':'す', 'ぜ':'せ', 'ぞ':'そ',
            'だ':'た', 'ぢ':'ち', 'づ':'つ', 'デ':'て', 'ど':'と',
            'ば':'は', 'ぱ':'はば',
            'び':'ひ', 'ぴ':'ひび',
            'ぶ':'ふ', 'ぷ':'ふぶ',
            'べ':'へ', 'ぺ':'へべ',
            'ぼ':'ほ', 'ぽ':'ほぼ',
            'ゔ':'う',
            'ゃ':'や', 'ゅ':'ゆ', 'ょ':'よ', 'っ':'つ', 'ゎ':'わ',
            'ァ':'ア', 'ィ':'イ', 'ゥ':'ウ', 'ェ':'エ', 'ォ':'オ',
            'ガ':'カ', 'ギ':'キ', 'グ':'ク', 'ゲ':'ケ', 'ゴ':'コ',
            'ザ':'サ', 'ジ':'シ', 'ズ':'ス', 'ゼ':'セ', 'ゾ':'ソ',
            'ダ':'タ', 'ヂ':'チ', 'ヅ':'ツ', 'デ':'テ', 'ド':'ト',
            'バ':'ハ', 'パ':'ハバ',
            'ビ':'ヒ', 'ピ':'ヒビ',
            'ブ':'フ', 'プ':'フブ',
            'ベ':'ヘ', 'ペ':'ヘベ',
            'ボ':'ホ', 'ポ':'ホボ',
            'ャ':'ヤ', 'ュ':'ユ', 'ョ':'ヨ', 'ッ':'ツ', 'ヮ':'ワ',
            'ヴ':'ウ', 'ヵ':'カ', 'ヶ':'ケ'
        };

        function classify(targetChar, inputChar, prevTargetChar, prevInputChar) {
            const targetIsKata = isKatakana(targetChar);
            if (targetChar === inputChar || (isProlongedMark(targetChar) && isProlongedInput(inputChar))) {
                if (isProlongedMark(targetChar) && prevTargetChar && isKatakana(prevTargetChar)) {
                    return prevInputChar && isHiragana(prevInputChar) ? 'correct-kata' : 'correct';
                }
                return 'correct';
            }
            if (targetIsKata) {
                const targetCode = targetChar.charCodeAt(0);
                const inputCode = inputChar.charCodeAt(0);
                if (targetCode >= 0x30A1 && targetCode <= 0x30F6 && inputCode >= 0x3041 && inputCode <= 0x3096 && targetCode === (inputCode + 0x60)) {
                    return 'correct-kata';
                }
            }

            if (pendingMap[targetChar] && pendingMap[targetChar].includes(inputChar)) {
                return 'pending';
            }

            if (/^[a-zA-Z]$/.test(inputChar)) {
                return 'pending';
            }

            return 'error';
        }

        return { classify };
    })();

    // 4. CpmTracker: Characters-Per-Minute calculator & timer
    const CpmTracker = (() => {
        let displayEl = null;
        const IDLE_THRESHOLD_MS = 3000;
        const TICK_INTERVAL_MS = 500;
        let totalActiveTimeMs = 0;
        let lastTickTime = 0;
        let lastKeystrokeTime = 0;
        let intervalId = null;
        let getInputLength = () => 0;
        let isReadOnly = () => true;

        function getEl() {
            if (!displayEl && typeof document !== 'undefined') {
                displayEl = document.getElementById('cpm-display');
            }
            return displayEl;
        }

        function configure({ getInputLength: g, isReadOnly: r, displayElement: d } = {}) {
            if (g) getInputLength = g;
            if (r) isReadOnly = r;
            if (d) displayEl = d;
        }

        function tick() {
            if (isReadOnly()) return;
            const now = Date.now();
            const delta = now - lastTickTime;
            lastTickTime = now;
            if (now - lastKeystrokeTime <= IDLE_THRESHOLD_MS) totalActiveTimeMs += delta;
            const el = getEl();
            if (totalActiveTimeMs > 0 && el) {
                const minutes = totalActiveTimeMs / 60000;
                el.textContent = Math.floor(getInputLength() / minutes) + ' 文字数/分';
            }
        }

        function onKeystroke(inputLength) {
            const el = getEl();
            const now = Date.now();
            if (!intervalId && inputLength > 0) {
                lastTickTime = now;
                lastKeystrokeTime = now;
                intervalId = setInterval(tick, TICK_INTERVAL_MS);
                if (el) el.style.display = 'block';
            }
            if (inputLength > 0) {
                lastKeystrokeTime = now;
            } else {
                reset();
            }
        }

        function stop() {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }

        function reset() {
            totalActiveTimeMs = 0;
            lastTickTime = 0;
            lastKeystrokeTime = 0;
            stop();
            const el = getEl();
            if (el) {
                el.textContent = ' 文字数/分';
                el.style.display = 'none';
            }
        }

        function getDisplayText() {
            const el = getEl();
            return el ? el.textContent : ' 文字数/分';
        }

        return {
            configure,
            onKeystroke,
            stop,
            reset,
            getDisplayText
        };
    })();

    // 5. Practice data pools
    const DEFAULT_POOL = [
        "わたしはきのうふるいパソコンでふゆのさくらをさつえいした",
        "ひこうきにのってみしらぬまちへむかいポストにれんらくする",
        "むずかしいしゅくだいをやっとおわらせてヨーロッパへいく",
        "よなかにあまいチョコレートやプリンをたべながらわらう",
        "ざっしやにほんごのれんしゅうもまいにちつづけています",
        "ぜったいにあきらめないでさいごまでプログラミングをがんばる",
        "るすばんのいぬがへやのなかでゴムのボールをおいかけている",
        "じてんしゃでやまをこえてピンクのうみのみえるばしょへいく",
        "きのうふったあめのおかげでくうきがとてもきれいでほっとした",
        "おなかがすいたのでしょくどうでぎょうざとラーメンをたのむ",
        "ろくじにおきてつめたいみずをコップいっぱいのんでからでかける",
        "わるいかぜをひいてしまいベッドできょうははやくねることにした",
        "あたらしいキーボードとマウスのセットはとてもうちやすい",
        "びじゅつかんでピカソのえをみてすばらしいデザインにかんどうした",
        "しんかんせんのきっぷをかってふゆのおんせんりょこうにいく",
        "どんなにむずかしいプロジェクトでもすこしずつかいけつできる"
    ];

    const ALL_KEYS_GROUPS = [
        "あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ ら り る れ ろ わ を ん 、 。 ？ ！ ア イ ウ エ オ カ キ ク ケ コ サ シ ス セ ソ タ チ ツ テ ト ナ ニ ヌ ネ ノ ハ ヒ フ ヘ ホ マ ミ ム メ モ ヤ ユ ヨ ラ リ ル レ ロ ワ ヲ ン",
        "が ぎ ぐ げ ご ざ じ ず ぜ ぞ だ ぢ づ で ど ば び ぶ べ ぼ ぱ ぴ ぷ ぺ ぽ ガ ギ グ ゲ ゴ ザ ジ ズ ゼ ゾ ダ ヂ ヅ デ ド バ ビ ブ ベ ボ パ ピ プ ペ ポ",
        "きゃ きゅ きょ しゃ しゅ しょ ちゃ ちゅ ちょ にゃ にゅ にょ ひゃ ひゅ ひょ みゃ みゅ みょ りゃ りゅ りょ ぎゃ ぎゅ ぎょ じゃ じゅ じょ びゃ びゅ びょ ぴゃ ぴゅ ぴょ かった まって やった わかった いって もっと ずっと きっと ちょっと やっぱり きっぷ しっぽ さっき あっち そっち どっち みっか よっか ざっし けっこう すっごい",
        "アー イー ウー エー オー カー キー クー ケー コー サー シー スー セー ソー ター チー ツー テー トー キャー キュー キョー シャー シュー ショー チャー チュー チョー ジャー ジュー ジョー"
    ];

    // 6. HistoryStore: typing session records manager
    const HistoryStore = (() => {
        const STORAGE_KEY = 'kana_practice_records';
        const MAX_RECORDS = 200;

        function load() {
            try {
                const raw = JSON.parse(SafeStorage.get(STORAGE_KEY, '[]'));
                return Array.isArray(raw) ? raw : [];
            } catch (err) {
                return [];
            }
        }

        function persist(records) {
            try {
                SafeStorage.set(STORAGE_KEY, JSON.stringify(records));
                return true;
            } catch (err) {
                return false;
            }
        }

        function save(cpmText) {
            const records = load();
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
            records.unshift({ date: dateStr, cpm: cpmText });
            persist(records.slice(0, MAX_RECORDS));
        }

        function clear() {
            SafeStorage.remove(STORAGE_KEY);
        }

        function isValidRecord(r) {
            return r && typeof r === 'object' && typeof r.date === 'string' && r.date.length <= 40 && typeof r.cpm === 'string' && r.cpm.length <= 40;
        }

        function importFromJson(jsonText) {
            const imported = JSON.parse(jsonText);
            if (!Array.isArray(imported)) throw new Error('Format Invalid');
            const validImported = imported.filter(isValidRecord);
            if (validImported.length === 0) throw new Error('Format Invalid');
            const merged = [...validImported, ...load()];
            const unique = Array.from(new Set(merged.map(r => JSON.stringify(r)))).map(s => JSON.parse(s));
            unique.sort((a, b) => new Date(b.date) - new Date(a.date));
            persist(unique.slice(0, MAX_RECORDS));
            return unique.slice(0, MAX_RECORDS);
        }

        function exportToDataUri() {
            return "data:text/json;charset=utf-8," + encodeURIComponent(SafeStorage.get(STORAGE_KEY, '[]'));
        }

        return { load, save, clear, isValidRecord, importFromJson, exportToDataUri, MAX_RECORDS };
    })();

    // 7. ModalManager: unified modal dialog stack with animations, Esc key, backdrop & scroll lock
    const ModalManager = (() => {
        const openModals = [];
        const closeCallbacks = new WeakMap();
        let onAllClosedCallback = null;
        let isInitialized = false;

        function init() {
            if (isInitialized || typeof window === 'undefined') return;
            isInitialized = true;

            // Global Escape key support
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && openModals.length > 0) {
                    e.preventDefault();
                    closeTop();
                }
            });

            // Set up backdrop click & touchmove protection
            if (typeof document !== 'undefined') {
                document.querySelectorAll('.modal').forEach(setupBackdropListeners);
            }
        }

        function setupBackdropListeners(modal) {
            if (!modal || modal.dataset.modalInit) return;
            modal.dataset.modalInit = 'true';

            let isBackdropDown = false;

            modal.addEventListener('mousedown', (e) => {
                isBackdropDown = (e.target === modal);
            });

            modal.addEventListener('click', (e) => {
                if (isBackdropDown && e.target === modal) {
                    close(modal);
                }
                isBackdropDown = false;
            });

            // Scroll lock: prevent rubber-banding on backdrop without touching body styles
            modal.addEventListener('touchmove', (e) => {
                if (e.target === modal) {
                    e.preventDefault();
                }
            }, { passive: false });
        }

        function open(modal, { display = 'flex', onOpen, onClose } = {}) {
            if (!modal) return;
            init();
            setupBackdropListeners(modal);

            const idx = openModals.indexOf(modal);
            if (idx === -1) {
                openModals.push(modal);
            }

            if (onClose) closeCallbacks.set(modal, onClose);
            else closeCallbacks.delete(modal);

            modal.classList.remove('is-closing');
            modal.style.display = display;

            requestAnimationFrame(() => {
                modal.classList.add('is-open');
            });

            if (onOpen) onOpen();
        }

        function close(modal, { immediate = false } = {}) {
            if (!modal) return;
            const idx = openModals.indexOf(modal);
            if (idx !== -1) {
                openModals.splice(idx, 1);
            }

            const cb = closeCallbacks.get(modal);
            if (cb) {
                closeCallbacks.delete(modal);
                cb();
            }

            const wasOpen = modal.classList.contains('is-open');
            modal.classList.remove('is-open');

            let finalized = false;
            const finalize = () => {
                if (finalized) return;
                finalized = true;
                modal.classList.remove('is-closing');
                modal.style.display = 'none';
            };

            if (immediate || !wasOpen) {
                finalize();
            } else {
                modal.classList.add('is-closing');
                modal.addEventListener('transitionend', finalize, { once: true });
                setTimeout(finalize, 180);
            }

            // If all modals closed, trigger focus restoration
            if (openModals.length === 0 && onAllClosedCallback) {
                onAllClosedCallback();
            }
        }

        function closeTop() {
            if (openModals.length === 0) return;
            const top = openModals[openModals.length - 1];
            close(top);
        }

        function isAnyOpen() {
            return openModals.length > 0;
        }

        function bindClose(btn, modal) {
            if (btn) btn.addEventListener('click', () => close(modal));
        }

        function setAllClosedCallback(fn) {
            onAllClosedCallback = fn;
        }

        return { init, open, close, closeTop, isAnyOpen, bindClose, setAllClosedCallback };
    })();

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => ModalManager.init());
        } else {
            ModalManager.init();
        }
    }

    // 8. UiFeedback: unified toast alert & modal confirmation dialog
    const UiFeedback = (() => {
        let alertTimeout = null;

        function alert(message, centerOnEl) {
            if (typeof document === 'undefined') return;
            const customAlert = document.getElementById('custom-alert');
            if (!customAlert) return;

            customAlert.textContent = message;
            if (centerOnEl && typeof centerOnEl.getBoundingClientRect === 'function') {
                const rect = centerOnEl.getBoundingClientRect();
                customAlert.style.top = `${rect.top + rect.height / 2}px`;
            } else {
                customAlert.style.top = '';
            }
            customAlert.style.display = 'block';
            customAlert.classList.remove('is-closing');
            requestAnimationFrame(() => customAlert.classList.add('is-open'));

            if (alertTimeout) clearTimeout(alertTimeout);
            alertTimeout = setTimeout(() => {
                customAlert.classList.remove('is-open');
                customAlert.classList.add('is-closing');
                setTimeout(() => {
                    customAlert.style.display = 'none';
                    customAlert.classList.remove('is-closing');
                }, 160);
            }, 2000);
        }

        function confirm(message, onConfirm, okLabel = '削除') {
            return new Promise((resolve) => {
                if (typeof document === 'undefined') {
                    resolve(false);
                    return;
                }

                const modal = document.getElementById('custom-confirm-modal') || document.getElementById('confirm-modal');
                const textEl = document.getElementById('custom-confirm-message') || document.getElementById('confirm-modal-text');
                const okBtn = document.getElementById('custom-confirm-ok-btn') || document.getElementById('confirm-modal-ok-btn');
                const cancelBtn = document.getElementById('custom-confirm-cancel-btn') || document.getElementById('confirm-modal-cancel-btn');

                if (!modal || !textEl || !okBtn || !cancelBtn) {
                    resolve(false);
                    return;
                }

                textEl.textContent = message;
                if (okLabel) okBtn.textContent = okLabel;

                let resolved = false;
                const cleanup = (confirmed) => {
                    if (resolved) return;
                    resolved = true;
                    okBtn.removeEventListener('click', onOk);
                    cancelBtn.removeEventListener('click', onCancel);
                    ModalManager.close(modal);
                    if (confirmed && typeof onConfirm === 'function') {
                        onConfirm();
                    }
                    resolve(confirmed);
                };
                const onOk = () => cleanup(true);
                const onCancel = () => cleanup(false);

                okBtn.addEventListener('click', onOk);
                cancelBtn.addEventListener('click', onCancel);

                ModalManager.open(modal, {
                    display: modal.id === 'custom-confirm-modal' ? 'block' : 'flex',
                    onClose: () => cleanup(false)
                });
            });
        }

        return {
            alert,
            confirm,
            get confirmModal() {
                return typeof document !== 'undefined'
                    ? (document.getElementById('custom-confirm-modal') || document.getElementById('confirm-modal'))
                    : null;
            }
        };
    })();

    // Export to global scope (Browser window / worker / node globalThis)
    global.SafeStorage = SafeStorage;
    global.escapeHtml = escapeHtml;
    global.shuffle = shuffle;
    global.retrySequence = retrySequence;
    global.KanaMatcher = KanaMatcher;
    global.CpmTracker = CpmTracker;
    global.DEFAULT_POOL = DEFAULT_POOL;
    global.DEFAULT_SENTENCE_POOL = DEFAULT_POOL; // Alias for backward compatibility
    global.ALL_KEYS_GROUPS = ALL_KEYS_GROUPS;
    global.HistoryStore = HistoryStore;
    global.ModalManager = ModalManager;
    global.UiFeedback = UiFeedback;

    // Export to CommonJS / Node.js if present
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            SafeStorage,
            escapeHtml,
            shuffle,
            retrySequence,
            KanaMatcher,
            CpmTracker,
            DEFAULT_POOL,
            DEFAULT_SENTENCE_POOL: DEFAULT_POOL,
            ALL_KEYS_GROUPS,
            HistoryStore,
            ModalManager,
            UiFeedback
        };
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
