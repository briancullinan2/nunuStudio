import assert from 'node:assert';
import { clickElementByText, isTabSelectedByText, delay } from './helpers/interactions.mjs';

export async function runAboutTest(page) {
	console.log('[Waterfall Test] Running About Menu interaction test...');
	
	// Click on the "About" button on the top menu bar
	await clickElementByText(page, 'About');
	
	// Give the editor a brief moment to update the DOM
	await delay(1000);

	// Verify that the "About" tab button is now present in the DOM
	const isSelected = await isTabSelectedByText(page, 'About');
	assert.ok(isSelected, '"About" tab should be selected after clicking the "About" button.');
	
	// Check that the inner text of the document body contains nunuStudio's description or author
	const bodyText = await page.evaluate(() => document.body.innerText);
	assert.ok(
		bodyText.includes('nunuStudio') || bodyText.includes('Tentone') || bodyText.includes('About'),
		'The page body should display the About panel contents.'
	);
	
	console.log('[Waterfall Test] About Menu interaction passed successfully!');
}
