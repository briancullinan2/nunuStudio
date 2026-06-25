import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const backupPath = path.resolve(__dirname, '../package.json.bak');

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

export function parseSemver(v) {
	const clean = v.replace(/[^0-9.]/g, '');
	const parts = clean.split('.').map(Number);
	return {
		major: parts[0] || 0,
		minor: parts[1] || 0,
		patch: parts[2] || 0
	};
}

export function incrementMinor(v) {
	const semver = parseSemver(v);
	return `${semver.major}.${semver.minor + 1}.0`;
}

export function incrementMajor(v) {
	const semver = parseSemver(v);
	return `${semver.major + 1}.0.0`;
}

function restoreBackup() {
	if (fs.existsSync(backupPath)) {
		fs.copyFileSync(backupPath, packageJsonPath);
		console.log('Restored original package.json from backup state.');
	}
}

async function testUpgrade(packageName, targetVersion, isDevDep) {
	const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

	if (isDevDep) {
		pkg.devDependencies[packageName] = targetVersion;
	} else {
		pkg.dependencies[packageName] = targetVersion;
	}

	fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf8');

	const success = runCommand('npm install') &&
		runCommand('npm run build-editor') &&
		runCommand('npm test');
	return success;
}

async function main() {
	console.log('Starting global dependency waterfall upgrade script...');

	// 1. Create a pristine workspace backup
	fs.copyFileSync(packageJsonPath, backupPath);
	console.log('Created global backup file.');

	const initialPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	const report = [];

	// Gather all target packages to process
	const targets = [];
	if (initialPkg.dependencies) {
		Object.keys(initialPkg.dependencies).forEach(name => {
			targets.push({ name, isDevDep: false, currentVersion: initialPkg.dependencies[name] });
		});
	}
	if (initialPkg.devDependencies) {
		Object.keys(initialPkg.devDependencies).forEach(name => {
			targets.push({ name, isDevDep: true, currentVersion: initialPkg.devDependencies[name] });
		});
	}

	// 2. Iterate sequentially through every dependency matching workspace rules
	for (const target of targets) {
		console.log(`\n====================================================================`);
		console.log(`PROCESSING COMPONENT: ${target.name} (${target.isDevDep ? 'devDependency' : 'dependency'})`);
		console.log(`====================================================================`);
		console.log(`Current established version: ${target.currentVersion}`);

		const pointVersion = incrementMinor(target.currentVersion);
		console.log(`Attempting Option A: Point Release Minor Upgrade -> ${pointVersion}`);

		// Try Minor Point Upgrade
		let success = await testUpgrade(target.name, pointVersion, target.isDevDep);
		if (success) {
			console.log(`🎉 Option A Succeeded! Keeping point release for ${target.name}.`);
			report.push({ name: target.name, outcome: 'UPGRADED (MINOR)', version: pointVersion });
			// Overwrite the baseline backup to lock in this successful upgrade for subsequent iterations
			fs.copyFileSync(packageJsonPath, backupPath);
			continue;
		}

		// Revert workspace back to previous stable point before trying major fallback
		console.warn(`⚠️ Option A failed. Reverting and trying Option B...`);
		restoreBackup();

		const majorVersion = incrementMajor(target.currentVersion);
		console.log(`Attempting Option B: Major Breaking Upgrade Upgrade -> ${majorVersion}`);

		// Try Major Breaking Upgrade
		success = await testUpgrade(target.name, majorVersion, target.isDevDep);
		if (success) {
			console.log(`🎉 Option B Succeeded! Keeping major version upgrade for ${target.name}.`);
			report.push({ name: target.name, outcome: 'UPGRADED (MAJOR)', version: majorVersion });
			fs.copyFileSync(packageJsonPath, backupPath);
			continue;
		}

		// Both options failed, drop package back to pristine state and move to next item
		console.error(`❌ Both upgrade paths failed for ${target.name}. Locking at ${target.currentVersion}.`);
		report.push({ name: target.name, outcome: 'FAILED (HELD)', version: target.currentVersion });
		restoreBackup();
	}

	// 3. Clean up backup file context and output final summary metrics
	if (fs.existsSync(backupPath)) {
		fs.unlinkSync(backupPath);
	}

	console.log(`\n====================================================================`);
	console.log(`## FINAL UPGRADE PIPELINE STATUS REPORT`);
	console.log(`====================================================================`);
	console.table(report);

	// Final clean installation loop to ensure tree dependencies reconcile cleanly
	console.log('\nExecuting final dependency layout synchronization...');
	runCommand('npm install');
	console.log('Suite processing finalized.');
}

main().catch(err => {
	console.error('Fatal execution error within waterfall upgrade script wrapper:', err);
	restoreBackup();
	runCommand('npm install');
	process.exit(1);
});