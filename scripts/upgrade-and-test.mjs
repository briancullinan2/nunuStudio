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
// ## SYSTEM UTILITIES & FILE I/O Wrappers
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

function readJsonFile(filePath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (error) {
		console.error(`Error reading file at ${filePath}:`, error.message);
		return null;
	}
}

function writeJsonFile(filePath, data) {
	try {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
		return true;
	} catch (error) {
		console.error(`Error writing file to ${filePath}:`, error.message);
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

function compareSemver(a, b) {
	const semverA = parseSemver(a);
	const semverB = parseSemver(b);
	if (semverA.major !== semverB.major) return semverA.major - semverB.major;
	if (semverA.minor !== semverB.minor) return semverA.minor - semverB.minor;
	return semverA.patch - semverB.patch;
}

// ============================================================================
// ## WORKSPACE STATE RECOVERY
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
// ## REGISTRY AND CONFIG PROCESSING FUNCTIONS
// ============================================================================
function fetchPackageRegistryData(packageName) {
	try {
		console.log(`Querying registry data up front for: ${packageName}`);
		const versionsOutput = execSync(`npm view ${packageName} versions --json`, { cwd: path.resolve(__dirname, '..') });
		const latestOutput = execSync(`npm view ${packageName} version`, { cwd: path.resolve(__dirname, '..') });

		const allVersions = JSON.parse(versionsOutput.toString().trim());
		const cleanVersions = allVersions.filter(v => !v.includes('-') && !v.includes('alpha') && !v.includes('beta'));

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
		return { pointVersion: currentVersion, majorVersion: currentVersion, versions: [] };
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

	return { cleanCurrent: versions[currentIndex] || cleanCurrent, pointVersion, majorVersion: nextMajorVersion, versions };
}

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

function applyVersionToPackage(filePath, targetName, version, isDevDep) {
	const pkg = readJsonFile(filePath);
	if (!pkg) return false;

	if (isDevDep) {
		if (!pkg.devDependencies) pkg.devDependencies = {};
		pkg.devDependencies[targetName] = version;
	} else {
		if (!pkg.dependencies) pkg.dependencies = {};
		pkg.dependencies[targetName] = version;
	}
	return writeJsonFile(filePath, pkg);
}

function verifyVersionSuccess(targetName, version) {
	try {
		const installSuccess = runCommand(`npm install ${targetName}@${version}`);
		if (!installSuccess) return false;

		const buildSuccess = runCommand('npm run build-editor');
		if (!buildSuccess) return false;

		const testSuccess = runCommand('npm test');
		return testSuccess;
	} catch (error) {
		console.error(`Execution crash during verification of ${targetName}@${version}:`, error.message);
		return false;
	}
}

// ============================================================================
// ## PIPELINE EXECUTION MATRICES
// ============================================================================
function evaluatePackageUpgrades(target, packageJsonPath, backupPath) {
	console.log(`\n====================================================================`);
	console.log(`UPGRADING: ${target.name} (${target.isDevDep ? 'devDependency' : 'dependency'})`);
	console.log(`====================================================================`);
	console.log(`Baseline Version: ${target.currentVersion}`);

	const versionPool = Array.isArray(target.versions) ? target.versions : [];
	const candidateVersions = [];

	if (target.pointVersion) candidateVersions.push(target.pointVersion);
	if (target.majorVersion && !candidateVersions.includes(target.majorVersion)) {
		candidateVersions.push(target.majorVersion);
	}

	if (versionPool.length > 0) {
		let lastIndex = -1;
		if (target.majorVersion) {
			lastIndex = versionPool.indexOf(target.majorVersion);
		}
		if (lastIndex === -1 && target.pointVersion) {
			lastIndex = versionPool.indexOf(target.pointVersion);
		}

		let addedCount = 0;
		const startIndex = lastIndex !== -1 ? lastIndex + 1 : 0;
		for (let i = startIndex; i < versionPool.length && addedCount < 3; i++) {
			const poolVer = versionPool[i];
			if (!candidateVersions.includes(poolVer)) {
				candidateVersions.push(poolVer);
				addedCount++;
			}
		}
	}

	if (!candidateVersions.includes('latest')) {
		candidateVersions.push('latest');
	}

	const uniqueCandidates = [...new Set(candidateVersions)];
	let highestWorkingVersion = null;

	for (const version of uniqueCandidates) {
		if (version === target.currentVersion) {
			console.log(`Already current version: ${version}, skipping.`);
			continue;
		} else if (target.currentVersion === target.absoluteLatest) {
			console.log(`Already latest version: ${version}, skipping.`);
			break;
		} else {
			console.log(`Testing candidate version: ${version}`);
		}

		try {
			if (!applyVersionToPackage(packageJsonPath, target.name, version, target.isDevDep)) {
				console.warn(`Failed to write candidate configuration for ${version}. Skipping.`);
				continue;
			}

			if (verifyVersionSuccess(target.name, version)) {
				console.log(`Candidate ${version} passed verification step.`);
				highestWorkingVersion = version;
				try {
					fs.copyFileSync(packageJsonPath, backupPath);
				} catch (backupErr) {
					console.error(`Failed to update stable reference backup configuration:`, backupErr.message);
				}
			} else {
				console.warn(`Candidate ${version} verification sequence failed.`);
				try {
					fs.copyFileSync(backupPath, packageJsonPath);
				} catch (restoreErr) {
					console.error(`Failed to restore baseline structural configuration:`, restoreErr.message);
				}
			}
		} catch (iterationError) {
			console.error(`Unexpected system fault processing candidate ${version}:`, iterationError.message);
			try {
				fs.copyFileSync(backupPath, packageJsonPath);
			} catch (restoreErr) {
				console.error(`Failed to restore baseline structural configuration after fault:`, restoreErr.message);
			}
		}
	}

	if (highestWorkingVersion) {
		return { outcome: 'UPGRADED', version: highestWorkingVersion };
	} else {
		return { outcome: 'HELD (FALLBACK)', version: target.currentVersion };
	}
}

// ============================================================================
// ## MAIN WATERFALL PIPELINE EXECUTION ENTRY
// ============================================================================
async function main() {
	console.log('Starting upfront-validated dependency upgrade script...');
	createWorkspaceBackup();

	const initialPkg = readJsonFile(packageJsonPath);
	if (!initialPkg) throw new Error("Could not parse root package.json file.");

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

		const { cleanCurrent, pointVersion, majorVersion, versions } = resolveNextTargetVersions(target.currentVersion, registryData);

		console.log(`[REGISTRY SELECTION] ${target.name}: Current: ${target.currentVersion} -> Selected Minor: ${pointVersion} | Next Major: ${majorVersion} (Absolute Latest: ${registryData.latest})`);

		targets.push({
			...target,
			cleanCurrent,
			pointVersion,
			majorVersion,
			versions, // Fixed: Forwarded full version mapping structure safely
			absoluteLatest: registryData.latest
		});
	}

	const finalPkg = readJsonFile(backupPath);
	for (const target of targets) {
		if (target.isDevDep) {
			if (finalPkg.devDependencies) finalPkg.devDependencies[target.name] = target.cleanCurrent;
		} else {
			if (finalPkg.dependencies) finalPkg.dependencies[target.name] = target.cleanCurrent;
		}
	}

	writeJsonFile(packageJsonPath, finalPkg);
	console.log('\nSaved all calculated clean target versions directly to package.json up front.');

	const success = runCommand(`npm install`) &&
		runCommand('npm run build-editor') &&
		runCommand('npm test');

	if (!success) {
		console.error(`❌ Could not find working configuration. Not reverting to backup, intervention required.`);
		return;
	} else {
		createWorkspaceBackup();
	}

	// ------------------------------------------------------------------------
	// ### PHASE 2: INTEGRATION AND TESTING
	// ------------------------------------------------------------------------
	console.log('\n--- PHASE 2: RUNNING EMIT AND TESTING SEQUENCES ---');
	const report = [];

	for (const target of targets) {
		try {
			const result = evaluatePackageUpgrades(target, packageJsonPath, backupPath);
			report.push({ name: target.name, outcome: result.outcome, version: result.version });
		} catch (targetError) {
			console.error(`Fatal exception tracking pipeline iteration for ${target.name}:`, targetError.message);
			report.push({ name: target.name, outcome: 'CRASHED (HELD)', version: target.currentVersion });
			try {
				fs.copyFileSync(backupPath, packageJsonPath);
			} catch (restoreErr) {
				console.error(`Critical failure executing generic fallback recovery:`, restoreErr.message);
			}
		}
	}

	try {
		cleanBackupFile();
	} catch (cleanupError) {
		console.error(`Non-blocking cleanup exception encountered during post-pipeline handling:`, cleanupError.message);
	}

	console.log(`\n====================================================================`);
	console.log(`## UPGRADE PIPELINE STATUS REPORT`);
	console.log(`====================================================================`);
	console.table(report);

	console.log('\nSyncing directory dependencies to verified lock configuration...');
	try {
		runCommand('npm install');
	} catch (finalInstallError) {
		console.error(`Final system sync returned operational warning or failure:`, finalInstallError.message);
	}
	console.log('Upfront batch optimization sequence finalized.');
}

main().catch(err => {
	console.error('Fatal execution crash within upgrade pipeline wrapper:', err);
	restoreBackup();
	runCommand('npm install');
	process.exit(1);
});