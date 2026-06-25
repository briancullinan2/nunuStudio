import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const backupPath = path.resolve(__dirname, '../package.json.bak');

// Helper to run a shell command and return its success/failure
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

// Parse semver into numeric components
export function parseSemver(v) {
	const clean = v.replace(/[^0-9.]/g, '');
	const parts = clean.split('.').map(Number);
	return {
		major: parts[0] || 0,
		minor: parts[1] || 0,
		patch: parts[2] || 0
	};
}

// Perform minor version upgrade (0.1 point release)
export function incrementMinor(v) {
	const semver = parseSemver(v);
	return `${semver.major}.${semver.minor + 1}.0`;
}

// Perform major version upgrade (full version release)
export function incrementMajor(v) {
	const semver = parseSemver(v);
	return `${semver.major + 1}.0.0`;
}

function restoreBackup() {
	if (fs.existsSync(backupPath)) {
		fs.copyFileSync(backupPath, packageJsonPath);
		fs.unlinkSync(backupPath);
		console.log('Restored original package.json from backup.');
	}
}

async function main() {
	// Determine target package to test upgrade on. Default to 'three' if none provided.
	const targetPackage = process.argv[2] || 'three';
	console.log(`Starting upgrade-and-test suite for package: "${targetPackage}"`);

	// 1. Create backup of package.json
	fs.copyFileSync(packageJsonPath, backupPath);
	console.log('Created package.json backup.');

	try {
		const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		let currentVersion = null;
		let isDevDep = false;

		if (pkg.dependencies && pkg.dependencies[targetPackage]) {
			currentVersion = pkg.dependencies[targetPackage];
		} else if (pkg.devDependencies && pkg.devDependencies[targetPackage]) {
			currentVersion = pkg.devDependencies[targetPackage];
			isDevDep = true;
		}

		if (!currentVersion) {
			console.error(`Error: Package "${targetPackage}" not found in dependencies or devDependencies.`);
			restoreBackup();
			process.exit(1);
		}

		console.log(`Current version of "${targetPackage}": ${currentVersion}`);

		// 2. Determine point release version (+0.1 minor version)
		const pointReleaseVersion = incrementMinor(currentVersion);
		console.log(`Upgrading to next point release: ${pointReleaseVersion}`);

		// Update package.json
		if (isDevDep) {
			pkg.devDependencies[targetPackage] = pointReleaseVersion;
		} else {
			pkg.dependencies[targetPackage] = pointReleaseVersion;
		}
		fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf8');

		console.log(`--- Testing Point Release Upgrade to ${pointReleaseVersion} ---`);
		
		// Run npm install, build, and test
		let pointReleaseSuccess = runCommand('npm install') && 
		                        runCommand('npm run build-editor') && 
		                        runCommand('npm test');

		if (pointReleaseSuccess) {
			console.log(`\n🎉 SUCCESS: Successfully upgraded "${targetPackage}" to point release ${pointReleaseVersion}! All builds and tests passed.`);
			fs.unlinkSync(backupPath); // Delete backup, keep upgrades
			process.exit(0);
		}

		console.warn(`\n⚠️ Point release upgrade to ${pointReleaseVersion} failed or hit version ceiling. Attempting full major version upgrade...`);
		
		// Restore to backup first to read the original version
		fs.copyFileSync(backupPath, packageJsonPath);
		const pkgFresh = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

		// 3. Determine full version upgrade (+1.0.0 major version)
		const majorReleaseVersion = incrementMajor(currentVersion);
		console.log(`Upgrading to next full major version: ${majorReleaseVersion}`);

		if (isDevDep) {
			pkgFresh.devDependencies[targetPackage] = majorReleaseVersion;
		} else {
			pkgFresh.dependencies[targetPackage] = majorReleaseVersion;
		}
		fs.writeFileSync(packageJsonPath, JSON.stringify(pkgFresh, null, 2), 'utf8');

		console.log(`--- Testing Full Major Release Upgrade to ${majorReleaseVersion} ---`);

		let majorReleaseSuccess = runCommand('npm install') && 
		                         runCommand('npm run build-editor') && 
		                         runCommand('npm test');

		if (majorReleaseSuccess) {
			console.log(`\n🎉 SUCCESS: Successfully upgraded "${targetPackage}" to full major release ${majorReleaseVersion}! All builds and tests passed.`);
			fs.unlinkSync(backupPath); // Delete backup, keep upgrades
			process.exit(0);
		}

		// If both failed, restore backup and exit with error
		console.error(`\n❌ FAILURE: Both point release (${pointReleaseVersion}) and major release (${majorReleaseVersion}) upgrades for "${targetPackage}" failed builds or tests.`);
		restoreBackup();
		
		// Run npm install one last time to restore node_modules to backup state
		runCommand('npm install');
		process.exit(1);

	} catch (error) {
		console.error('An unexpected error occurred during upgrade-and-test:', error);
		restoreBackup();
		runCommand('npm install');
		process.exit(1);
	}
}

main();
