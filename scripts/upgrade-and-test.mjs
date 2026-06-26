import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ============================================================================
// ## CONFIGURATION & CORE PATH RESOLUTION
// ============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const backupPath = path.resolve(__dirname, '../package.json.bak');

// ============================================================================
// ## CORE SYSTEM SHELL COMMAND EXECUTION
// ============================================================================
function runCommand(cmd) {
	console.log(`Executing: ${cmd}`);
	try {
		execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
		return true;
	} catch (error) {
		console.error(`Command failed: ${cmd}`);
		return false;
	}
}

// ============================================================================
// ## DETERMINISTIC SEMVER COMPARISON UTILITIES
// ============================================================================
export function parseSemver(v) {
	const clean = v.replace(/[^0-9.]/g, '');
	const parts = clean.split('.').map(Number);
	return {
		major: parts[0] || 0,
		minor: parts[1] || 0,
		patch: parts[2] || 0
	};
}

// Fixed: Returns standard sort sorting values (-1, 0, 1) rather than a boolean flag
function compareSemver(a, b) {
	const semverA = parseSemver(a);
	const semverB = parseSemver(b);
	if (semverA.major !== semverB.major) return semverA.major - semverB.major;
	if (semverA.minor !== semverB.minor) return semverA.minor - semverB.minor;
	return semverA.patch - semverB.patch;
}

// ============================================================================
// ## TRUE ARRAY STEPPING LOGIC
// ============================================================================
function fetchPackageRegistryData(packageName) {
	try {
		console.log(`Querying registry data up front for: ${packageName}`);
		const versionsOutput = execSync(`npm view ${packageName} versions --json`, { cwd: path.resolve(__dirname, '..') });
		const latestOutput = execSync(`npm view ${packageName} version`, { cwd: path.resolve(__dirname, '..') });

		const allVersions = JSON.parse(versionsOutput.toString().trim());
		const cleanVersions = allVersions.filter(v => !v.includes('-') && !v.includes('alpha') && !v.includes('beta'));

		// Fixed: Pure numeric sorting baseline
		cleanVersions.sort(compareSemver);

		return {
			versions: cleanVersions,
			latest: latestOutput.toString().trim()
		};
	} catch (error) {
		console.warn(`Could not trace registry history for "${packageName}".`);
		return null;
	}
}

function resolveNextTargetVersions(currentVersion, registryData) {
	if (!registryData || !registryData.versions.length) {
		return { pointVersion: currentVersion, majorVersion: currentVersion };
	}

	const versions = registryData.versions;
	const cleanCurrent = currentVersion.replace(/[^0-9.]/g, '');

	let currentIndex = versions.indexOf(cleanCurrent);

	if (currentIndex === -1) {
		currentIndex = versions.findIndex(v => compareSemver(v, cleanCurrent) > 0) - 1;
		if (currentIndex < 0) currentIndex = 0;
	}

	const pointVersion = (currentIndex + 1 < versions.length) ? versions[currentIndex + 1] : registryData.latest;

	const currentMajor = parseSemver(cleanCurrent).major;
	let nextMajorVersion = registryData.latest;

	for (let i = currentIndex + 1; i < versions.length; i++) {
		if (parseSemver(versions[i]).major > currentMajor) {
			nextMajorVersion = versions[i];
			break;
		}
	}

	return { pointVersion, majorVersion: nextMajorVersion };
}

// ============================================================================
// ## BACKUP AND STATE MANAGEMENT
// ============================================================================
function createWorkspaceBackup() {
	fs.copyFileSync(packageJsonPath, backupPath);
	console.log('Created pristine workspace package.json backup.');
}

function restoreBackup() {
	if (fs.existsSync(backupPath)) {
		fs.copyFileSync(backupPath, packageJsonPath);
		console.log('Restored package.json from backup state.');
	}
}

function cleanBackupFile() {
	if (fs.existsSync(backupPath)) {
		fs.unlinkSync(backupPath);
	}
}

// ============================================================================
// ## INTERNALS
// ============================================================================
function collectUpgradeTargets(pkgJson) {
	const targets = [];
	if (pkgJson.dependencies) {
		Object.keys(pkgJson.dependencies).forEach(name => {
			targets.push({ name, isDevDep: false, currentVersion: pkgJson.dependencies[name] });
		});
	}
	if (pkgJson.devDependencies) {
		Object.keys(pkgJson.devDependencies).forEach(name => {
			targets.push({ name, isDevDep: true, currentVersion: pkgJson.devDependencies[name] });
		});
	}
	return targets;
}

// ============================================================================
// ## MAIN WATERFALL PIPELINE EXECUTION
// ============================================================================
async function main() {
	console.log('Starting upfront-validated dependency upgrade script...');
	createWorkspaceBackup();

	const initialPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	const rawTargets = collectUpgradeTargets(initialPkg);
	const targets = [];


	// ------------------------------------------------------------------------
	// ### PHASE 1: COLLECT AND VERIFY TARGETS (NON-DESTRUCTIVE)
	// ------------------------------------------------------------------------
	console.log('\n--- PHASE 1: COLLECTING VALID VERSIONS FROM REGISTRY ---');
	for (const target of rawTargets) {
		const registryData = fetchPackageRegistryData(target.name);

		if (!registryData) {
			console.warn(`Skipping upfront resolution for ${target.name} due to fetch error.`);
			continue;
		}

		const { pointVersion, majorVersion } = resolveNextTargetVersions(target.currentVersion, registryData);

		console.log(`[REGISTRY SELECTION] ${target.name}: Current: ${target.currentVersion} -> Selected Minor: ${pointVersion} | Next Major: ${majorVersion} (Absolute Latest: ${registryData.latest})`);

		targets.push({
			...target,
			pointVersion,
			majorVersion,
			absoluteLatest: registryData.latest
		});
	}

	const finalPkg = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

	for (const target of targets) {
		if (target.isDevDep) {
			if (finalPkg.devDependencies) finalPkg.devDependencies[target.name] = target.pointVersion;
		} else {
			if (finalPkg.dependencies) finalPkg.dependencies[target.name] = target.pointVersion;
		}
	}

	fs.writeFileSync(packageJsonPath, JSON.stringify(finalPkg, null, 2), 'utf8');
	console.log('\nSaved all calculated clean target versions directly to package.json up front.');


	// ------------------------------------------------------------------------
	// ### PHASE 2: INTEGRATION AND TESTING
	// ------------------------------------------------------------------------
	console.log('\n--- PHASE 2: RUNNING EMIT AND TESTING SEQUENCES ---');
	const report = [];

	// Test Minor Point Releases sequentially to keep state execution pristine
	for (const target of targets) {
		console.log(`\n====================================================================`);
		console.log(`UPGRADING: ${target.name} (${target.isDevDep ? 'devDependency' : 'dependency'})`);
		console.log(`====================================================================`);
		console.log(`Baseline Version: ${target.currentVersion}`);
		console.log(`Testing Real Minor Step: ${target.pointVersion}`);

		const baselineClean = target.currentVersion.replace(/[^0-9.]/g, '');
		if (target.pointVersion === baselineClean) {
			console.log(`Package already at latest available version pool. Skipping.`);
			report.push({ name: target.name, outcome: 'HELD (ALREADY LATEST)', version: target.currentVersion });
			continue;
		}

		// Stage Option A (Minor) from current stable backup anchor
		if (target.isDevDep) finalPkg.devDependencies[target.name] = target.pointVersion;
		else finalPkg.dependencies[target.name] = target.pointVersion;
		fs.writeFileSync(packageJsonPath, JSON.stringify(finalPkg, null, 2), 'utf8');

		let success = runCommand(`npm install ${target.name}@${target.pointVersion}`) &&
			runCommand('npm run build-editor') &&
			runCommand('npm test');

		if (success) {
			console.log(`🎉 Option A Succeeded for ${target.name}.`);
			report.push({ name: target.name, outcome: 'UPGRADED (MINOR)', version: target.pointVersion });
			fs.copyFileSync(packageJsonPath, backupPath); // Lock down stable reference state change
			continue;
		}

		console.warn(`⚠️ Option A failed. Reverting reference and trying Option B...`);
		restoreBackup();

		if (target.majorVersion === target.pointVersion) {
			console.error(`❌ Target major version identical to failed minor variant step. Skipping.`);
			report.push({ name: target.name, outcome: 'FAILED (HELD)', version: target.currentVersion });
			continue;
		}

		// Stage Option B (Major)
		console.log(`Testing Option B: -> ${target.majorVersion}`);
		const pkgLoop = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
		if (target.isDevDep) pkgLoop.devDependencies[target.name] = target.majorVersion;
		else pkgLoop.dependencies[target.name] = target.majorVersion;
		fs.writeFileSync(packageJsonPath, JSON.stringify(pkgLoop, null, 2), 'utf8');

		success = runCommand(`npm install ${target.name}@${target.majorVersion}`) &&
			runCommand('npm run build-editor') &&
			runCommand('npm test');

		if (success) {
			console.log(`🎉 Option B Succeeded for ${target.name}.`);
			report.push({ name: target.name, outcome: 'UPGRADED (MAJOR)', version: target.majorVersion });
			fs.copyFileSync(packageJsonPath, backupPath);
			continue;
		}

		console.error(`❌ Upgrade paths rejected for ${target.name}. Reverting down to baseline.`);
		report.push({ name: target.name, outcome: 'FAILED (HELD)', version: target.currentVersion });
		restoreBackup();
	}

	cleanBackupFile();

	console.log(`\n====================================================================`);
	console.log(`## FINAL UPGRADE PIPELINE STATUS REPORT`);
	console.log(`====================================================================`);
	console.table(report);

	console.log('\nSyncing directory dependencies to verified lock configuration...');
	runCommand('npm install');
	console.log('Upfront batch optimization sequence finalized.');
}

main().catch(err => {
	console.error('Fatal execution crash within upgrade pipeline wrapper:', err);
	restoreBackup();
	runCommand('npm install');
	process.exit(1);
});