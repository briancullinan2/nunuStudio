import assert from 'node:assert';
import { hoverElementByText, clickElementByText, isTabSelectedByText, delay } from './helpers/interactions.mjs';

export async function runSettingsTest(page) {
	console.log('[Waterfall Test] Running Settings interaction test...');
	
	// 1. Hover over the "File" menu button to expand the options
	await hoverElementByText(page, 'File');
	await delay(1000);

	// 2. Click the "Settings" option in the expanded dropdown
	await clickElementByText(page, 'Settings');
	await delay(1000);

	// 3. Verify that the "Settings" tab button is now present and selected in the DOM
	const isSelected = await isTabSelectedByText(page, 'Settings');
	assert.ok(isSelected, 'The "Settings" tab should be selected after being clicked.');

	// 4. Verify some settings-specific DOM content (like settings tab inputs or titles)
	const bodyText = await page.evaluate(() => document.body.innerText);
	assert.ok(
		bodyText.includes('General') || bodyText.includes('Theme') || bodyText.includes('Settings'),
		'The page body should display the settings tab content (e.g. General / Theme settings options).'
	);

	console.log('[Waterfall Test] Settings interaction passed successfully!');
}
