import { describe, it } from 'node:test';
import assert from 'node:assert';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the missing delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Three.js Integration Test', () => {
	it('should render a green cube onto a GL canvas', async () => {
		const browser = await puppeteer.launch({
			headless: false,
			slowMo: 50,
			args: [
				'--start-maximized',
				'--no-sandbox',
				'--disable-setuid-sandbox'
				// Removed swiftshader flags so your actual GPU can render to the visible window
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

			// Let you see the browser for 5 seconds before it closes
			await delay(5000);

			// Assertions
			assert.deepStrictEqual(result.errors, []);
			assert.strictEqual(result.success, true);
			assert.ok(result.pixelData[1] > 0); // Green channel must be non-zero

			console.log('Integration Test WebGL Specs:', {
				glVersion: result.glVersion,
				glVendor: result.glVendor,
				glRenderer: result.glRenderer,
				pixelCenterColor: result.pixelData
			});

		} finally {
			// This block ALWAYS runs, ensuring the window closes even if the test fails
			await browser.close();
		}
	});
});