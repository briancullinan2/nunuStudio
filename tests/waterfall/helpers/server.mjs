import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find your true project root
const projectRoot = path.resolve(__dirname, '../../../');
const docsDir = path.join(projectRoot, 'docs');

export function createStaticServer(dir, port = 0) {
	const server = http.createServer((req, res) => {
		let reqUrl = req.url.split('?')[0];
		if (reqUrl === '/') reqUrl = '/index.html';

		// 1. Generate a prioritized list of fallback file paths to check
		const targetPaths = [
			path.join(dir, reqUrl),                        // Check passed test/editor directory context first
			path.join(projectRoot, reqUrl),                 // Check the project root
			path.join(docsDir, reqUrl),                     // Check the docs directory
			path.join(docsDir, 'editor', reqUrl)            // Check docs/editor specifically
		];

		// 2. Find the first path that actually exists on disk
		let filePath = targetPaths.find(p => fs.existsSync(p));

		// Fallback to the first path if none exist (so it triggers a clean 404 stream)
		if (!filePath) {
			filePath = targetPaths[0];
		}

		const ext = path.extname(filePath);
		const contentTypes = {
			'.html': 'text/html',
			'.js': 'application/javascript',
			'.css': 'text/css',
			'.png': 'image/png',
			'.jpg': 'image/jpeg',
			'.json': 'application/json',
			'.ico': 'image/x-icon',
			'.wasm': 'application/wasm'
		};

		const contentType = contentTypes[ext] || 'application/octet-stream';

		fs.readFile(filePath, (err, content) => {
			if (err) {
				res.writeHead(404, { 'Content-Type': 'text/plain' });
				res.end(`404 Not Found: ${filePath}`);
			} else {
				res.writeHead(200, { 'Content-Type': contentType });
				res.end(content);
			}
		});
	});

	return new Promise((resolve) => {
		server.listen(port, '127.0.0.1', () => {
			const address = server.address();
			resolve({
				port: address.port,
				url: `http://127.0.0.1:${address.port}`,
				close: () => new Promise((r) => server.close(r))
			});
		});
	});
}