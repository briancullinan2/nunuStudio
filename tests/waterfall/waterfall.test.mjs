import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our modular helpers and tests for chaining
import { createStaticServer } from './helpers/server.mjs';
import { delay } from './helpers/interactions.mjs';
import { runMenuTest } from './menu.test.mjs';
import { runTabsTest } from './tabs.test.mjs';
import { runSettingsTest } from './settings.test.mjs';
import { runAboutTest } from './about.test.mjs';
import { runShapesTest } from './shapes.test.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('nunuStudio Editor Waterfall E2E Tests', () => {
	let server;
	let browser;
	let page;

	// ============================================================================
	// ## SETUP: ENVIRONMENT INITIALIZATION
	// ============================================================================
	before(async () => {
		// Start the static server serving docs/editor
		const editorDir = path.resolve(__dirname, '../../docs/editor');
		server = await createStaticServer(editorDir);
		console.log(`\n[Setup] Waterfall test server running at: ${server.url}`);

		// Launch Puppeteer in headful mode
		browser = await puppeteer.launch({
			headless: false,
			slowMo: 50,
			args: [
				'--start-maximized',
				'--no-sandbox',
				'--disable-setuid-sandbox'
			]
		});

		page = await browser.newPage();
		await page.setViewport({ width: 1280, height: 720 });

		// Route browser logs to test console
		page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
		page.on('pageerror', err => console.error('[Browser Page Error]:', err.stack || err.message));
	});

	// ============================================================================
	// ## TEARDOWN: RESOURCE CLEANUP
	// ============================================================================
	after(async () => {
		console.log('\n[Teardown] Closing browser and static server...');
		if (browser) await browser.close();
		if (server) await server.close();
	});

	// ============================================================================
	// ## INDIVIDUAL TEST CASES (THE PRETTY TITLES)
	// ============================================================================

	it('01. Should load the editor and initialize the DOM layout successfully', async () => {
		await page.goto(server.url, { waitUntil: 'load' });

		console.log('Waiting for the UI layout to initialize...');
		await page.waitForFunction(() => {
			return document.querySelectorAll('canvas').length > 0 || document.querySelectorAll('div').length > 5;
		}, { timeout: 15000 });

		await delay(2000); // Allow post-render layouts to settle
	});

	it('02. Should handle top-level context menu hover and expansions', async () => {
		await runMenuTest(page);
		await delay(1000);
	});

	it('03. Should switch between distinct layout panels and active tabs', async () => {
		await runTabsTest(page);
		await delay(1000);
	});

	it('04. Should open the global application settings dashboard panel', async () => {
		await runSettingsTest(page);
		await delay(1000);
	});

	it('05. Should open and validate the application About text components', async () => {
		await runAboutTest(page);
		await delay(1000);
	});

	it('06. Should successfully spawn and attach a 3D Cube primitive shape', async () => {
		await runShapesTest(page);
		await delay(3000); // Leave visible briefly on completion
	});
});