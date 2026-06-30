import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import puppeteer from 'puppeteer';
import path from 'path';
import Webpack from 'webpack';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('nunuStudio Native ES6 Class Isolation Smoke Suite', () => {
    let server;
    let browser;
    let page;

    before(async () => {
        console.log('\n[Setup] Loading root Webpack configuration pass...');
        const configPath = path.resolve(__dirname, '../../webpack.config.js');
        const webpackConfigModule = await import(pathToFileURL(configPath).href);


        const baseConfig = Array.isArray(webpackConfigModule.default)
            ? webpackConfigModule.default[1]
            : webpackConfigModule.default;

        // Force clean slates on all chunk-splitting structures inherited from runtime.js
        const runtimeConfig = {
            ...baseConfig,
            entry: path.resolve(__dirname, './Main.js'),
            output: {
                ...baseConfig.output,
                hashFunction: "sha256",
                path: path.resolve(__dirname, '../../docs/editor/files/runtime'),
                filename: "nunu.smoke.js",
                library: {
                    name: "Nunu",
                    type: "umd"
                },
                globalObject: "this"
            },
            /* BLOW AWAY ALL INHERITED RUNTIME CODE-SPLITTING SETTINGS */
            optimization: {
                ...baseConfig.optimization,
                splitChunks: false,
                runtimeChunk: false,
                concatenateModules: false
            },
            /* FORCE SINGLE OUTPUT COMPILATION */
            plugins: [
                new Webpack.ProvidePlugin({
                    THREE: "three",
                    "window.THREE": "three"
                }),
                new Webpack.optimize.LimitChunkCountPlugin({
                    maxChunks: 1
                })
            ],
            externals: {
                "../../source/core/Nunu.js": "Nunu",
                "../source/core/Nunu.js": "Nunu",
                "./source/core/Nunu.js": "Nunu"
            }

        };


        console.log('[Setup] Compiling isolated engine target code...');
        await new Promise((resolve, reject) => {
            Webpack(runtimeConfig, (err, stats) => {
                if (err) return reject(err);
                if (stats.hasErrors()) {
                    const info = stats.toJson();
                    return reject(new Error(info.errors.map(e => e.message).join('\n')));
                }
                console.log(' ✅ Isolated smoke bundle written cleanly to build distribution.');
                resolve();
            });
        });

        // Initialize server context mapping
        const projectRootDir = path.resolve(__dirname, '../../');
        const { createStaticServer } = await import('./helpers/server.mjs');
        server = await createStaticServer(projectRootDir);

        browser = await puppeteer.launch({
            headless: false,
            slowMo: 20,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
        });

        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
        page.on('pageerror', err => console.error('[Browser Page Error]:', err.stack || err.message));
    });

    after(async () => {
        console.log('\n[Teardown] Clearing smoke testing environment allocations...');
        if (browser) await browser.close();
        if (server) await server.close();
    });

    it('01. Should parse object prototypes and maintain class contexts natively', async () => {
        const testPageUrl = `${server.url}/tests/integration/test-core.html`;
        await page.goto(testPageUrl, { waitUntil: 'load' });

        // Let execution cycle settle down
        const { delay } = await import('./helpers/interactions.mjs');
        await delay(1500);

        const testResult = await page.evaluate(() => window.testResult);

        console.log('\n--- BUNDLE EVALUATION SCOPE DATA ---');
        console.dir(testResult, { depth: null });
        console.log('------------------------------------\n');

        assert.strictEqual(
            testResult.success,
            true,
            `Compilation order defect identified: ES6 runtime class instantiation threw an initialization error. Log: ${JSON.stringify(testResult.errors || testResult.error)}`
        );

        assert.strictEqual(testResult.programCreated, true, 'Program core class context initialization failed.');
        assert.strictEqual(testResult.sceneCreated, true, 'Scene core class context initialization failed.');
        assert.strictEqual(testResult.streamCreated, true, 'VideoStream context snapped on initialization.');

        console.log(' 🚀 VERIFICATION COMPLETE: Your baseline ES6 class conversions are structurally sound!');
    });
});