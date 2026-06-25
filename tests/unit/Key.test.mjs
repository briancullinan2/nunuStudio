import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Key } from '../../source/core/input/Key.js';
import { Keyboard } from '../../source/core/input/Keyboard.js';

describe('Key Unit Tests', () => {
	it('should initialize with default states', () => {
		const key = new Key();
		assert.strictEqual(key.pressed, false);
		assert.strictEqual(key.justPressed, false);
		assert.strictEqual(key.justReleased, false);
	});

	it('should handle Key.DOWN transitions', () => {
		const key = new Key();
		key.update(Key.DOWN);
		assert.strictEqual(key.pressed, true);
		assert.strictEqual(key.justPressed, true);
		assert.strictEqual(key.justReleased, false);

		// Subsequent down actions should keep it pressed but not justPressed
		key.update(Key.DOWN);
		assert.strictEqual(key.pressed, true);
		assert.strictEqual(key.justPressed, false);
		assert.strictEqual(key.justReleased, false);
	});

	it('should handle Key.UP transitions', () => {
		const key = new Key();
		key.update(Key.DOWN);
		assert.strictEqual(key.pressed, true);

		key.update(Key.UP);
		assert.strictEqual(key.pressed, false);
		assert.strictEqual(key.justPressed, false);
		assert.strictEqual(key.justReleased, true);
	});

	it('should manually set and reset values', () => {
		const key = new Key();
		key.set(true, true, false);
		assert.strictEqual(key.pressed, true);
		assert.strictEqual(key.justPressed, true);
		assert.strictEqual(key.justReleased, false);

		key.reset();
		assert.strictEqual(key.pressed, false);
		assert.strictEqual(key.justPressed, false);
		assert.strictEqual(key.justReleased, false);
	});
});

describe('Keyboard Unit Tests', () => {
	// Set up window mockup for EventManager / Keyboard initialization in Node environment
	const oldWindow = global.window;
	global.window = {
		addEventListener() {},
		removeEventListener() {}
	};

	it('should initialize keyboard without crashing', () => {
		const keyboard = new Keyboard(true);
		assert.ok(keyboard);
		assert.deepStrictEqual(keyboard.keys, []);
		assert.deepStrictEqual(keyboard.actions, []);
	});

	it('should process buffered actions on update', () => {
		const keyboard = new Keyboard(true);
		
		// Simulate key down event
		const KEY_CODE = 65; // 'A'
		keyboard.actions.push(KEY_CODE, Key.DOWN);

		// Run update
		keyboard.update();

		// Key should now be pressed and just pressed
		assert.ok(keyboard.keys[KEY_CODE]);
		assert.strictEqual(keyboard.keys[KEY_CODE].pressed, true);
		assert.strictEqual(keyboard.keys[KEY_CODE].justPressed, true);

		// Next update should reset justPressed
		keyboard.update();
		assert.strictEqual(keyboard.keys[KEY_CODE].pressed, true);
		assert.strictEqual(keyboard.keys[KEY_CODE].justPressed, false);
	});

	// Restore global state
	global.window = oldWindow;
});
