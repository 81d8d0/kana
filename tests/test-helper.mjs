import fs from 'fs';
import path from 'path';
import http from 'http';
import vm from 'vm';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Extracts a specific JS module or block from index.html into a VM sandbox
 */
export function extractFromHtml(htmlRelativePath, regexPattern, exportKey, extraContext = {}) {
    const fullPath = path.join(ROOT_DIR, htmlRelativePath);
    const html = fs.readFileSync(fullPath, 'utf8');
    const match = html.match(regexPattern);
    if (!match) {
        throw new Error(`Pattern not found in ${htmlRelativePath}: ${regexPattern}`);
    }
    const context = {
        console,
        Date,
        Math,
        Array,
        String,
        RegExp,
        JSON,
        Set,
        WeakMap,
        ...extraContext
    };
    vm.createContext(context);
    vm.runInContext(match[0] + (exportKey ? `; this.${exportKey} = ${exportKey};` : ''), context);
    return exportKey ? context[exportKey] : context;
}

/**
 * Starts a minimal zero-dependency static HTTP server
 */
export function createStaticServer(port = 8190) {
    const server = http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
        const filePath = path.join(ROOT_DIR, reqPath);
        if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.svg': 'image/svg+xml'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
    });

    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
            resolve({
                server,
                url: `http://127.0.0.1:${port}`,
                close: () => new Promise(cb => server.close(cb))
            });
        });
    });
}

/**
 * Launches Headless Chrome and connects via WebSocket CDP
 */
export async function launchHeadlessChrome(serverUrl, initialPath = '/index.html') {
    const debugPort = 9223 + Math.floor(Math.random() * 500);
    const tmpDir = `/tmp/chrome_test_${debugPort}`;

    const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
        '--headless',
        `--remote-debugging-port=${debugPort}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${tmpDir}`,
        `${serverUrl}${initialPath}`
    ], { stdio: 'ignore' });

    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 150));
        try {
            const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
            const pages = await res.json();
            const page = pages.find(p => p.type === 'page');
            if (page && page.webSocketDebuggerUrl) {
                wsUrl = page.webSocketDebuggerUrl;
                break;
            }
        } catch (e) {}
    }

    if (!wsUrl) {
        chrome.kill();
        throw new Error(`Failed to connect to Headless Chrome on port ${debugPort}`);
    }

    const ws = new WebSocket(wsUrl);
    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id && callbacks.has(msg.id)) {
            callbacks.get(msg.id)(msg);
            callbacks.delete(msg.id);
        }
    };

    const send = (method, params = {}) => {
        return new Promise((resolve, reject) => {
            const id = msgId++;
            callbacks.set(id, (res) => {
                if (res.error) reject(new Error(res.error.message || JSON.stringify(res.error)));
                else resolve(res.result);
            });
            ws.send(JSON.stringify({ id, method, params }));
        });
    };

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await send('Page.enable');

    // Wait a brief moment for page initialization scripts to run
    await new Promise(r => setTimeout(r, 600));

    const evaluate = async (expression) => {
        const res = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        return res?.result?.value;
    };

    const close = async () => {
        try { ws.close(); } catch (e) {}
        try { chrome.kill(); } catch (e) {}
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    };

    return { ws, send, evaluate, close };
}
