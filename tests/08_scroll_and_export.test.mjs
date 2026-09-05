import test from "node:test";
import assert from "node:assert/strict";
import { createStaticServer, launchHeadlessChrome } from "./test-helper.mjs";

test("E2E: Export creates kana_record_YYYYMMDD.json via Blob download", async () => {
    const server = await createStaticServer(8208);
    const client = await launchHeadlessChrome(server.url, "/index.html");

    try {
        await client.evaluate(`(() => {
            const records = [{ date: "2026/09/05 19:50", cpm: "280 文字数/分" }];
            localStorage.setItem("kana_practice_records", JSON.stringify(records));
        })()`);

        await client.evaluate(`document.getElementById("history-btn").click()`);
        await new Promise(r => setTimeout(r, 200));

        const intercepted = await client.evaluate(`(() => {
            let captured = null;
            const originalCreateElement = document.createElement.bind(document);
            document.createElement = function(tagName) {
                const el = originalCreateElement(tagName);
                if (tagName.toLowerCase() === "a") {
                    el.click = function() {
                        captured = {
                            download: el.download || el.getAttribute("download"),
                            href: el.href || el.getAttribute("href")
                        };
                    };
                }
                return el;
            };

            document.getElementById("export-btn").click();
            document.createElement = originalCreateElement;
            return captured;
        })()`);

        assert.ok(intercepted, "Export button should trigger anchor download");
        assert.match(
            intercepted.download,
            /^kana_record_\d{8}\.json$/,
            "Download filename must be kana_record_YYYYMMDD.json"
        );
        assert.ok(
            intercepted.href.startsWith("blob:") || intercepted.href.startsWith("data:"),
            "Download link must be valid Blob URL or Data URI"
        );
    } finally {
        await client.close();
        await server.close();
    }
});

test("E2E: Document layout auto-scrolls up 2 lines when row finishes", async () => {
    const server = await createStaticServer(8209);
    const client = await launchHeadlessChrome(server.url, "/index.html");

    try {
        await client.evaluate(`(() => {
            if (document.body.classList.contains("layout-classic")) {
                document.getElementById("layout-toggle-btn").click();
            }
        })()`);
        await new Promise(r => setTimeout(r, 300));

        const longSentence = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん" +
                             "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
        
        await client.evaluate(`PracticeEngine.init(${JSON.stringify(longSentence)})`);
        await new Promise(r => setTimeout(r, 200));

        const initialScrollTop = await client.evaluate(`document.getElementById("text-layer").scrollTop`);
        assert.equal(initialScrollTop, 0, "Initial scrollTop should be 0");

        const typedLength = await client.evaluate(`(() => {
            const input = document.getElementById("kana-input");
            const spans = document.querySelectorAll(".char-wrapper");

            let typed = "";
            for (let i = 0; i < 65 && i < spans.length; i++) {
                typed += spans[i].querySelector(".char-target").textContent;
            }
            input.value = typed;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            return typed.length;
        })()`);

        assert.equal(typedLength, 65);
        await new Promise(r => setTimeout(r, 600));

        const finalScrollTop = await client.evaluate(`document.getElementById("text-layer").scrollTop`);
        assert.ok(
            finalScrollTop > 0,
            "text-layer should have scrolled up when typing down into rows"
        );
    } finally {
        await client.close();
        await server.close();
    }
});

test("E2E: Classic layout auto-scrolls when reaching input area boundary", async () => {
    const server = await createStaticServer(8210);
    const client = await launchHeadlessChrome(server.url, "/index.html");

    try {
        await client.evaluate(`(() => {
            if (!document.body.classList.contains("layout-classic")) {
                document.getElementById("layout-toggle-btn").click();
            }
        })()`);
        await new Promise(r => setTimeout(r, 300));

        const longSentence = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん" +
                             "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
        
        await client.evaluate(`PracticeEngine.init(${JSON.stringify(longSentence)})`);
        await new Promise(r => setTimeout(r, 200));

        const typedLength = await client.evaluate(`(() => {
            const input = document.getElementById("kana-input");
            const spans = document.querySelectorAll(".char-wrapper");

            let typed = "";
            for (let i = 0; i < 40 && i < spans.length; i++) {
                typed += spans[i].querySelector(".char-target").textContent;
            }
            input.value = typed;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            return typed.length;
        })()`);

        assert.equal(typedLength, 40);
        await new Promise(r => setTimeout(r, 600));

        const finalScrollTop = await client.evaluate(`document.getElementById("text-layer").scrollTop`);
        assert.ok(
            finalScrollTop > 0,
            "Classic layout text-layer should auto-scroll up when rows advance near input area"
        );
    } finally {
        await client.close();
        await server.close();
    }
});
