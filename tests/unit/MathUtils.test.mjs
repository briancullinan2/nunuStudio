import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MathUtils } from '../../source/core/utils/MathUtils.js';

describe('MathUtils Unit Tests', () => {
	it('should have correct mathematical constants', () => {
		assert.ok(Math.abs(MathUtils.PI2 - Math.PI * 2) < 0.00001);
		assert.ok(Math.abs(MathUtils.PID3 - Math.PI / 3) < 0.00001);
		assert.ok(Math.abs(MathUtils.PID2 - Math.PI / 2) < 0.00001);
	});

	it('should generate valid hex random colors', () => {
		for (let i = 0; i < 10; i++) {
			const color = MathUtils.randomColor();
			assert.match(color, /^#[0-9A-F]{6}$/i);
		}
	});
});
