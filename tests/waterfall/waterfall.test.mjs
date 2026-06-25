import { describe, it } from 'node:test';
import assert from 'node:assert';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our modular helpers and tests for chaining
import { createStaticServer } from './helpers/server.mjs';
import { delay } from './helpers/interactions.mjs';
import { runMenuTest } from './menu.test.mjs';
import { runTabsTest } from './tabs.test.mjs';
import { runAboutTest } from './about.test.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('nunuStudio Editor Waterfall E2E Tests', () => {
	it('should load the editor and execute all chained UI interactions', async () => {
		// 1. Start the static server serving docs/editor
		const editorDir = path.resolve(__dirname, '../../docs/editor');
		const server = await createStaticServer(editorDir);
		console.log(`Waterfall test server running at: ${server.url}`);

		// 2. Launch Puppeteer in headful mode as requested
		const browser = await puppeteer.launch({
			headless: false,
			slowMo: 50,
			args: [
				'--start-maximized',
				'--no-sandbox',
				'--disable-setuid-sandbox'
			]
		});

		try {
			const page = await browser.newPage();
			
			// Set a standard viewport size
			await page.setViewport({ width: 1280, height: 720 });

			// Route all console messages and page errors from browser to test logs
			page.on('console', msg => {
				console.log(`[Browser Console ${msg.type()}]:`, msg.text());
			});
			page.on('pageerror', err => {
				console.error('[Browser Page Error]:', err.stack || err.message);
			});

			// 3. Navigate to the editor
			await page.goto(server.url, { waitUntil: 'load' });

			// 4. Wait for the actual canvas or primary layout elements to attach to the body
			console.log('Waiting for the UI layout to initialize...');
			await page.waitForFunction(() => {
				// nunuStudio creates elements directly inside document.body or canvas elements
				return document.querySelectorAll('canvas').length > 0 || document.querySelectorAll('div').length > 5;
			}, { timeout: 15000 });
			console.log('UI elements detected.');

			// Wait a brief moment to allow any post-render layouts to finalize
			await delay(2000);

			// 5. Execute our chained tests sequentially
			console.log('--- BEGIN CHAINED WATERFALL TESTS ---');
			
			// Test 1: Hovering over the top-level menus and expanding dropdown options
			await runMenuTest(page);
			await delay(1000);

			// Test 2: Clicking and switching between tab panels (e.g., the Console tab)
			await runTabsTest(page);
			await delay(1000);

			// Test 3: Clicking the About menu, verifying the About tab is opened and selected,
			// and confirming the displayed text content.
			await runAboutTest(page);
			await delay(3000); // Leave browser visible briefly to let user witness completion

			console.log('--- ALL CHAINED WATERFALL TESTS COMPLETED SUCCESSFULLY ---');

		} catch (error) {
			console.error('Waterfall E2E test suite failed with error:', error);
			throw error;
		} finally {
			// 6. Clean up browser and server
			await browser.close();
			await server.close();
		}
	});
});
