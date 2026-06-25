export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for an element containing specific text to appear in the DOM.
 */
export async function waitForElementByText(page, text, timeout = 10000) {
	try {
		return await page.waitForFunction((matchText) => {
			const elements = Array.from(document.querySelectorAll('div, span, button, a'));
			return elements.find(el => el.textContent.trim() === matchText);
		}, { timeout }, text);
	} catch (error) {
		throw new Error(`Timeout waiting for element containing text: "${text}"`);
	}
}

/**
 * Click an element containing specific text.
 */
export async function clickElementByText(page, text) {
	await waitForElementByText(page, text);

	// 1. Find the element handle using Puppeteer's locator tracking
	const elementHandle = await page.evaluateHandle((matchText) => {
		const elements = Array.from(document.querySelectorAll('div, span, button, a'));
		return elements.find(el => el.textContent.trim() === matchText);
	}, text);

	const element = elementHandle.asElement();
	if (!element) {
		throw new Error(`Could not find element with text: "${text}"`);
	}

	try {
		// 2. Get the physical viewport coordinates of the element bounding box
		const box = await element.boundingBox();
		if (!box) {
			throw new Error(`Element with text "${text}" is not visible or lacks a layout box.`);
		}

		// 3. Move mouse to the center of the element and execute a true physical click
		const centerX = box.x + box.width / 2;
		const centerY = box.y + box.height / 2;

		await page.mouse.click(centerX, centerY);
	} finally {
		// Clean up the handle allocation
		await elementHandle.dispose();
	}
}
/**
 * Hover over an element containing specific text.
 */
export async function hoverElementByText(page, text) {
	await waitForElementByText(page, text);
	const hovered = await page.evaluate((matchText) => {
		const elements = Array.from(document.querySelectorAll('div, span, button, a'));
		const found = elements.find(el => el.textContent.trim() === matchText);
		if (found) {
			// Dispatch mouseenter/mouseover events to simulate hover
			found.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
			found.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
			return true;
		}
		return false;
	}, text);

	if (!hovered) {
		throw new Error(`Could not hover over element with text: "${text}"`);
	}
}

/**
 * Check if a tab with specific text is currently selected.
 * In nunuStudio, selected tab buttons are styled with "var(--button-over-color)" background color.
 */
export async function isTabSelectedByText(page, text) {
	return await page.evaluate((matchText) => {
		const divs = Array.from(document.querySelectorAll('div'));
		const tabBtn = divs.find(d => d.textContent.trim() === matchText && d.style.cursor === 'pointer');
		if (!tabBtn) return false;

		// If the background matches the active button color (which in dark theme is typically --button-over-color / #333333 / etc.)
		const bg = tabBtn.style.backgroundColor;
		return bg && (bg.includes('button-over-color') || bg !== 'var(--bar-color)');
	}, text);
}
