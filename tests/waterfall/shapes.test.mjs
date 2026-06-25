import assert from 'node:assert';
import { delay } from './helpers/interactions.mjs';

export async function runShapesTest(page) {
	console.log('[Waterfall Test] Running Shapes interaction test...');

	// 1. Hover/click the "Add Models" button drawer in the sidebar.
	// The image source is "icons/models/models.png".
	await page.evaluate(() => {
		const img = Array.from(document.querySelectorAll('img')).find(el => el.src.includes('icons/models/models.png'));
		if (!img) {
			throw new Error('Could not find models button drawer icon.');
		}
		const button = img.parentElement;
		button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
		button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
	});

	await delay(1000);

	// 2. Click the "Cube" option in the expanded drawer.
	// The image source is "icons/models/cube.png".
	const clicked = await page.evaluate(() => {
		const img = Array.from(document.querySelectorAll('img')).find(el => el.src.includes('icons/models/cube.png'));
		if (!img) {
			return false;
		}
		img.parentElement.click();
		return true;
	});

	assert.ok(clicked, 'Should find and click the Cube option in the models drawer.');
	await delay(1500);

	// 3. Verify that the cube was added.
	// When an object is added to the editor, its name (e.g. "cube") is rendered in the UI, such as in the object tree view.
	const bodyText = await page.evaluate(() => document.body.innerText);
	assert.ok(
		bodyText.toLowerCase().includes('cube'),
		'The scene tree view or editor UI should reflect that the "cube" has been added.'
	);

	console.log('[Waterfall Test] Shapes interaction passed successfully!');
}
