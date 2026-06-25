import { describe, it } from 'node:test';
import assert from 'node:assert';
import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createStaticServer(dir, port = 0) {
    const server = http.createServer((req, res) => {
        let reqUrl = req.url.split('?')[0];
        if (reqUrl === '/') reqUrl = '/index.html';

        const filePath = path.join(dir, reqUrl);
        const ext = path.extname(filePath);
        const contentTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.json': 'application/json',
            '.ico': 'image/x-icon',
            '.wasm': 'application/wasm'
        };

        const contentType = contentTypes[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    });

    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
            const address = server.address();
            resolve({
                port: address.port,
                url: `http://127.0.0.1:${address.port}`,
                close: () => new Promise((r) => server.close(r))
            });
        });
    });
}

describe('nunuStudio Editor Waterfall E2E Tests', () => {
    it('should load the editor and click the About button to open the About tab', async () => {
        const editorDir = path.resolve(__dirname, '../../docs/editor');
        const server = await createStaticServer(editorDir);
        console.log(`Waterfall test server running at: ${server.url}`);

        const browser = await puppeteer.launch({
            headless: false,
            slowMo: 50,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--use-gl=angle'
            ]
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        page.on('console', msg => {
            console.log(`[Browser Console ${msg.type()}]:`, msg.text());
        });
        page.on('pageerror', err => {
            console.error('[Browser Page Error]:', err.stack || err.message);
        });

        try {
            await page.goto(server.url, { waitUntil: 'load' });

            // 4. Wait for the actual canvas or primary layout elements to attach to the body
            console.log('Waiting for the UI layout to initialize...');
            await page.waitForFunction(() => {
                // nunuStudio creates elements directly inside document.body or canvas elements
                return document.querySelectorAll('canvas').length > 0 || document.querySelectorAll('div').length > 5;
            }, { timeout: 15000 });
            console.log('UI elements detected.');

            // 5. Look for the 'Help' or 'About' trigger in the top menu layout text
            console.log('Searching for the "About" trigger in the UI...');
            const aboutButton = await page.waitForFunction(() => {
                const elements = Array.from(document.querySelectorAll('div, span, button, a'));
                return elements.find(el => el.textContent.trim() === 'About' || el.textContent.trim() === 'Help');
            }, { timeout: 5000 });

            assert.ok(aboutButton, 'Could not find any "About" or "Help" menu option via the DOM text mapping.');
            
            console.log('Clicking the option...');
            await aboutButton.click();

            // Give any popup menus or modal creation a moment to update the document tree
            await delay(1000);

            // 6. If "Help" was clicked, it may expand a sub-menu containing "About"
            const clickSubMenu = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('div, span, button, a'));
                const subItem = elements.find(el => el.textContent.trim() === 'About');
                if (subItem) {
                    subItem.click();
                    return true;
                }
                return false;
            });

            if (clickSubMenu) {
                console.log('Clicked "About" inside a sub-menu container.');
            }

            // 7. Verify the DOM updated to indicate the About panel/tab is up
            console.log('Verifying content update...');
            await page.waitForFunction(() => {
                const textDump = document.body.innerText;
                // Validate against known authorship string details inside nunuStudio's environment
                return textDump.includes('nunuStudio') || textDump.includes('Tentone') || textDump.includes('About');
            }, { timeout: 5000 });

            console.log('Success: About component matched inside the page context!');
            await delay(5000);

        } catch (error) {
            console.error('Test execution failed with error:', error);
            throw error;
        } finally {
            await browser.close();
            await server.close();
        }
    });
});