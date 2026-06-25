import { describe, it } from 'node:test';
import assert from 'node:assert';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

import { createStaticServer } from '../waterfall/helpers/server.mjs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the missing delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Three.js Integration Tests', () => {
	it('should render a green cube onto a GL canvas', async () => {
		const browser = await puppeteer.launch({
			headless: false,
			slowMo: 50,
			args: [
				'--start-maximized',
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--allow-file-access-from-files'
			]
		});

		try {
			const page = await browser.newPage();

			// Get absolute file path for the test HTML page
			const filePath = path.resolve(__dirname, 'test-page.html');
			const fileUrl = `file://${filePath}`;

			// Navigate to the local HTML file
			await page.goto(fileUrl, { waitUntil: 'load' });

			// Wait for the test result to be set
			await page.waitForFunction(() => window.testResult !== undefined);

			// Get the test result
			const result = await page.evaluate(() => window.testResult);

			// Let you see the browser for 3 seconds before it closes
			await delay(3000);

			// Assertions
			assert.deepStrictEqual(result.errors, []);
			assert.strictEqual(result.success, true);
			assert.ok(result.pixelData[1] > 0); // Green channel must be non-zero

			console.log('Cube Integration Test WebGL Specs:', {
				glVersion: result.glVersion,
				glVendor: result.glVendor,
				glRenderer: result.glRenderer,
				pixelCenterColor: result.pixelData
			});

		} finally {
			await browser.close();
		}
	});



	it('should inject texture loader and render a loaded texture onto a GL canvas', async () => {
		// 1. Spin up the static server on the folder containing your test files
		// (Assuming test-loader.html and its textures live in this integration directory)
		const server = await createStaticServer(__dirname);
		console.log(`Texture test server running at: ${server.url}`);

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

			// 2. Navigate via HTTP instead of file://
			const testUrl = `${server.url}/test-loader.html`;
			await page.goto(testUrl, { waitUntil: 'load' });

			// Wait for the loader test result to be set
			await page.waitForFunction(() => window.testResult !== undefined, { timeout: 10000 });

			// Get the test result
			const result = await page.evaluate(() => window.testResult);

			// Let you see the browser for 3 seconds before it closes
			await delay(3000);

			// Assertions
			assert.deepStrictEqual(result.errors, []);
			assert.strictEqual(result.success, true);
			assert.ok(result.textureWidth > 0);
			assert.ok(result.textureHeight > 0);
			assert.ok(result.pixelData[0] > 0 || result.pixelData[1] > 0 || result.pixelData[2] > 0);

			console.log('Texture Loader Integration Test WebGL Specs:', {
				glVersion: result.glVersion,
				glRenderer: result.glRenderer,
				loadedTextureDimensions: `${result.textureWidth}x${result.textureHeight}`,
				pixelCenterColor: result.pixelData
			});

		} finally {
			// Clean up both the browser and our temporary server instance
			await browser.close();
			await server.close();
		}
	});
});
