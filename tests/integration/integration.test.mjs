import { describe, it } from 'node:test';
import assert from 'node:assert';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createStaticServer } from '../waterfall/helpers/server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Three.js and Nunu Core Integration Tests', () => {
	let server;
	let projectRoot;

	// Start the static server before running tests
	it('should initialize the local HTTP server', async () => {
		projectRoot = path.resolve(__dirname, '../../');
		server = await createStaticServer(projectRoot);
		console.log(`Integration test server running at: ${server.url}`);
	});

	it('should render a green cube onto a GL canvas', async () => {
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
			// Navigate to the local server hosted HTML file to avoid CORS blocks
			const testUrl = `${server.url}/tests/integration/test-page.html`;

			await page.goto(testUrl, { waitUntil: 'load' });
			await page.waitForFunction(() => window.testResult !== undefined);
			const result = await page.evaluate(() => window.testResult);

			await delay(3000);

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
			// Navigate via HTTP server
			const testUrl = `${server.url}/tests/integration/test-loader.html`;

			await page.goto(testUrl, { waitUntil: 'load' });
			await page.waitForFunction(() => window.testResult !== undefined, { timeout: 10000 });
			const result = await page.evaluate(() => window.testResult);

			await delay(3000);

			assert.deepStrictEqual(result.errors, []);
			assert.strictEqual(result.success, true);
			assert.ok(result.textureWidth > 0, 'Texture width should be non-zero');
			assert.ok(result.textureHeight > 0, 'Texture height should be non-zero');
			assert.ok(result.pixelData[0] > 0 || result.pixelData[1] > 0 || result.pixelData[2] > 0, 'Should render non-black pixels from texture');

			console.log('Texture Loader Integration Test WebGL Specs:', {
				glVersion: result.glVersion,
				glRenderer: result.glRenderer,
				loadedTextureDimensions: `${result.textureWidth}x${result.textureHeight}`,
				pixelCenterColor: result.pixelData
			});
		} finally {
			await browser.close();
		}
	});

	it('should test Nunu Core platform and feature integrations with query params', async () => {
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
			// Navigate via HTTP server and inject query parameters
			const testUrl = `${server.url}/tests/integration/test-nunu.html?testParam=hello&nunu=cool`;

			await page.goto(testUrl, { waitUntil: 'load' });
			await page.waitForFunction(() => window.testResult !== undefined, { timeout: 10000 });
			const result = await page.evaluate(() => window.testResult);

			await delay(3000);

			assert.deepStrictEqual(result.errors, []);
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.platform, 201); // Nunu.BROWSER = 201
			assert.strictEqual(result.webglAvailable, true, 'WebGL should be supported in Chromium');
			assert.strictEqual(result.webaudioAvailable, true, 'WebAudio should be supported in Chromium');
			
			// Verify query parameters parsed correctly
			assert.deepStrictEqual(result.queryParams, { testParam: 'hello', nunu: 'cool' });

			// Verify copyNamespace worked
			assert.deepStrictEqual(result.copiedNamespace, { a: 1, b: 2, c: 'hello' });

			console.log('Nunu Core Integration Test Specs:', {
				parsedQueryParams: result.queryParams,
				platformType: result.platform,
				webglAvailable: result.webglAvailable,
				webaudioAvailable: result.webaudioAvailable
			});
		} finally {
			await browser.close();
		}
	});

	// Tear down server at the end of tests
	it('should stop the local HTTP server', async () => {
		if (server) {
			await server.close();
			console.log('Integration test server stopped.');
		}
	});
});
