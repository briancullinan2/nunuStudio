const Path = require("path");
const Webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MergeIntoSingleFilePlugin = require("webpack-merge-and-include-globally");
const CopyPlugin = require("copy-webpack-plugin");
const { merge } = require("webpack-merge");
const runtime = require("./webpack.runtime.js");
const CircularDependencyPlugin = require('circular-dependency-plugin');

const source = Path.resolve(__dirname, "source");
const output = Path.resolve(__dirname, "docs/editor");
const node = Path.resolve(__dirname, "node_modules");


module.exports = [
	{
		context: source,
		entry: source + "/editor/Main.js",
		target: ["web", "es2020"],
		devtool: false,
		performance: {
			hints: false,
		},
		module: {
			rules: [
				{
					test: /\.glsl$/i,
					use: "raw-loader"
				},
				{
					// Forces Webpack to preserve internal module properties during optimization passes
					//test: /node_modules\/three/,
					//sideEffects: true
				},
				{
					test: /.*brython.*/,
					loader: "@shoutem/webpack-prepend-append",
					options: JSON.stringify({
						prepend: `(function (root, factory) {
                        if (typeof define === 'function' && define.amd) { define([], factory); }  // AMD loader
                        else if (typeof module === 'object' && module.exports) { module.exports = factory(); }  // CommonJS loader
                        else { root.brython = factory(); }  // Script tag
                        }(typeof self !== 'undefined' ? self : this, function () {
                        var process = {release: {name: ''}};`,
						append: `window.__BRYTHON__ = __BRYTHON__;
                        return __BRYTHON__;
                        }));`
					})
				}
			]
		},
		output: {
			hashFunction: "sha256",
			filename: "bundle.js",
			path: output,
			environment: {
				arrowFunction: true,
				const: true,
				destructuring: true,
				forOf: true,
				module: true,
			}
		},
		plugins: [
			new Webpack.optimize.LimitChunkCountPlugin({
				maxChunks: 1
			}),
			new CircularDependencyPlugin({
				exclude: /a\.js|node_modules/,
				include: /source/,
				failOnError: true, // Tells you exactly which files are loops
				allowAsyncCycles: false,
				cwd: process.cwd(),
			}),
			new CopyPlugin({
				patterns: [
					{
						from: source + "/files",
						to: output + "/files",
						force: true
					}
				],
				options: { concurrency: 100 }
			}),
			new HtmlWebpackPlugin({ template: source + "/editor/index.html", filename: "index.html" }),
			new Webpack.ProgressPlugin(),
			new Webpack.ProvidePlugin({
				THREE: "three",
				"window.THREE": "three"
			}),
			new MergeIntoSingleFilePlugin({
				files: {
					"package.json": [
						"package.json"
					],
					"styles.css": [
						source + "/editor/style.css",
						source + "/editor/theme/dark.css"
					],
					"draco_encoder.js": [
						source + "/lib/draco_encoder.js"
					],
					"jshint.js": [
						node + "/jshint/dist/jshint.js"
					],
					"acorn.js": [
						node + "/acorn/dist/acorn.js",
						node + "/acorn-loose/dist/acorn-loose.js",
						node + "/acorn-walk/dist/walk.js"
					],
					"tern.js": [
						node + "/tern/lib/signal.js",
						node + "/tern/lib/tern.js",
						node + "/tern/lib/def.js",
						node + "/tern/lib/comment.js",
						node + "/tern/lib/infer.js",
						node + "/tern/plugin/doc_comment.js"
					],
					"codemirror.js": [
						node + "/codemirror/lib/codemirror.js",
						node + "/codemirror/keymap/sublime.js",
						node + "/codemirror/keymap/emacs.js",
						node + "/codemirror/keymap/vim.js",
						node + "/codemirror/mode/python/python.js",
						node + "/codemirror/mode/javascript/javascript.js",
						node + "/codemirror/mode/css/css.js",
						node + "/codemirror/mode/xml/xml.js",
						node + "/codemirror/mode/htmlmixed/htmlmixed.js",
						node + "/codemirror/addon/edit/closebrackets.js",
						node + "/codemirror/addon/edit/matchbrackets.js",
						node + "/codemirror/addon/scroll/annotatescrollbar.js",
						node + "/codemirror/addon/search/search.js",
						node + "/codemirror/addon/search/searchcursor.js",
						node + "/codemirror/addon/search/jump-to-line.js",
						node + "/codemirror/addon/search/match-highlighter.js",
						node + "/codemirror/addon/search/matchesonscrollbar.js",
						node + "/codemirror/addon/hint/show-hint.js",
						node + "/codemirror/addon/hint/anyword-hint.js",
						node + "/codemirror/addon/dialog/dialog.js",
						node + "/codemirror/addon/selection/mark-selection.js",
						node + "/codemirror/addon/selection/active-line.js",
						node + "/codemirror/addon/selection/selection-pointer.js",
						node + "/codemirror/addon/lint/lint.js",
						node + "/codemirror/addon/lint/javascript-lint.js",
						node + "/codemirror/addon/tern/tern.js",
						node + "/codemirror/addon/runmode/colorize.js",
						node + "/codemirror/addon/runmode/runmode.js"
					],
					"codemirror.css": [
						node + "/codemirror/lib/codemirror.css",
						node + "/codemirror/theme/**/*.css",
						node + "/codemirror/addon/search/matchesonscrollbar.css",
						node + "/codemirror/addon/tern/tern.css",
						node + "/codemirror/addon/dialog/dialog.css",
						node + "/codemirror/addon/lint/lint.css",
						node + "/codemirror/addon/hint/show-hint.css"
					]
				}
			})
		]
	},
	merge(runtime[0], {
		output: {
			hashFunction: "sha256",
			filename: "nunu.min.js",
			path: output + "/files/runtime",
			library: "Nunu",
			libraryTarget: "umd"
		}
	})
];
