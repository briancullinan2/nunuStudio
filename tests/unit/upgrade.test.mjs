import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseSemver, incrementMinor, incrementMajor } from '../../scripts/upgrade-and-test.mjs';

describe('NPM Upgrade & Version Ceiling Logic Tests', () => {
	it('should parse semver strings correctly', () => {
		const parsed1 = parseSemver('1.2.3');
		assert.deepStrictEqual(parsed1, { major: 1, minor: 2, patch: 3 });

		const parsed2 = parseSemver('^0.14.2');
		assert.deepStrictEqual(parsed2, { major: 0, minor: 14, patch: 2 });

		const parsed3 = parseSemver('v12.0.5');
		assert.deepStrictEqual(parsed3, { major: 12, minor: 0, patch: 5 });
	});

	it('should correctly increment 0.1 point release higher (incrementMinor)', () => {
		const result = incrementMinor('1.2.3');
		assert.strictEqual(result, '1.3.0');

		const result2 = incrementMinor('^0.14.2');
		assert.strictEqual(result2, '0.15.0');
	});

	it('should correctly increment by 1 when version ceiling is hit (incrementMajor)', () => {
		const result = incrementMajor('1.2.3');
		assert.strictEqual(result, '2.0.0');

		const result2 = incrementMajor('^0.14.2');
		assert.strictEqual(result2, '1.0.0');
	});

	it('should simulate the upgrade flow where point release upgrade hits a ceiling and transitions to major upgrade', () => {
		// Mock package version
		const originalVersion = '1.2.0';
		let packageJsonVersion = originalVersion;

		// Version ceilings defined for this package
		const ceilingVersion = '1.3.0'; // point release upgrade to '1.3.0' hits the ceiling/fails

		// Helper to simulate a build/test run based on version
		function simulateBuildAndTest(version) {
			if (version === ceilingVersion) {
				console.log(`[Simulation] Build failed or hit ceiling for version ${version}`);
				return false; // Fails / ceiling hit
			}
			console.log(`[Simulation] Build successfully completed for version ${version}`);
			return true; // Succeeds
		}

		// --- Step 1: Attempt Point Release Upgrade (+0.1) ---
		const pointReleaseVersion = incrementMinor(packageJsonVersion);
		packageJsonVersion = pointReleaseVersion;
		assert.strictEqual(packageJsonVersion, '1.3.0', 'Point release should be 1.3.0');

		let buildSuccess = simulateBuildAndTest(packageJsonVersion);
		
		if (!buildSuccess) {
			console.log('[Simulation] Ceiling hit! Retrying by upgrading version by 1 major release...');
			
			// --- Step 2: Hit version ceiling, upgrade by 1 major release (+1.0.0) and try to rebuild ---
			const majorReleaseVersion = incrementMajor(originalVersion);
			packageJsonVersion = majorReleaseVersion;
			assert.strictEqual(packageJsonVersion, '2.0.0', 'Major release should be 2.0.0');

			buildSuccess = simulateBuildAndTest(packageJsonVersion);
		}

		assert.strictEqual(buildSuccess, true, 'Major upgrade should successfully build and pass');
		assert.strictEqual(packageJsonVersion, '2.0.0', 'Final upgraded version should be 2.0.0');
	});
});
