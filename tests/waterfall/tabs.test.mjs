import assert from 'node:assert';
import { clickElementByText, isTabSelectedByText, delay } from './helpers/interactions.mjs';

export async function runTabsTest(page) {
	console.log('[Waterfall Test] Running Tabs switching test...');
	
	// Click on the "Console" tab
	await clickElementByText(page, 'Console');
	await delay(1000);

	// Verify that the Console tab is selected
	const isConsoleSelected = await isTabSelectedByText(page, 'Console');
	assert.ok(isConsoleSelected, 'The "Console" tab should be selected after being clicked.');

	console.log('[Waterfall Test] Tabs switching passed successfully!');
}
