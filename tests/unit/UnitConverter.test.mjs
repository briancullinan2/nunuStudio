import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UnitConverter } from '../../source/core/utils/UnitConverter.js';

describe('UnitConverter Unit Tests', () => {
	it('should support scales', () => {
		assert.strictEqual(UnitConverter.scales.get('k'), 1000);
		assert.strictEqual(UnitConverter.scales.get('m'), 0.001);
	});

	it('should convert units without scales', () => {
		const val = UnitConverter.convert(1, 'm', 'i'); // 1 meter to inches
		assert.ok(Math.abs(val - 39.3701) < 0.0001);
	});

	it('should convert units with scales', () => {
		const val = UnitConverter.convert(1, 'km', 'm'); // 1 kilometer to meters
		assert.strictEqual(val, 1000);
	});

	it('should convert temperature', () => {
		// Kelvin to Celsius (k -> c)
		assert.ok(Math.abs(UnitConverter.convert(273.15, 'k', 'c') - 0) < 0.001);
		// Celsius to Kelvin (c -> k)
		assert.ok(Math.abs(UnitConverter.convert(0, 'c', 'k') - 273.15) < 0.001);
	});
});
