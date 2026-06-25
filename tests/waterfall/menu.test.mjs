import assert from 'node:assert';
import { hoverElementByText, waitForElementByText, delay } from './helpers/interactions.mjs';

export async function runMenuTest(page) {
	console.log('[Waterfall Test] Running Menu dropdown expansion test...');
	
	// Hover over the "File" menu option
	await hoverElementByText(page, 'File');
	await delay(1000);

	// When expanded, options like "New" (or "New" option text) should exist in the DOM
	const newElement = await waitForElementByText(page, 'New');
	assert.ok(newElement, 'The dropdown menu option "New" should be rendered after hovering over "File".');

	console.log('[Waterfall Test] Menu dropdown expansion passed successfully!');
}
