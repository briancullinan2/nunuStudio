const Path = require("path");
const { merge } = require("webpack-merge");
const Webpack = require("webpack");
const { GitRevisionPlugin } = require("git-revision-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const common = require("./webpack.config.js");

const git = new GitRevisionPlugin();
const output = Path.resolve(__dirname, "docs/editor");

module.exports = [
	merge(common[0], {
		devtool: false,
		mode: "production",
		optimization: {
			minimize: true,
			usedExports: true,
			concatenateModules: false,
			minimizer: [
				new TerserPlugin({
					terserOptions: {
						compress: {
							passes: 2,
							dead_code: true
						},
						mangle: true,
						output: {
							comments: false
						}
					},
					extractComments: false
				})
			]
		},
		performance: {
			hints: false,
		},
		plugins: [
			new Webpack.DefinePlugin({
				"VERSION": JSON.stringify(require("./package.json").version),
				"TIMESTAMP": JSON.stringify(new Date().toISOString()),
				"REPOSITORY_BRANCH": JSON.stringify(git.branch()),
				"REPOSITORY_COMMIT": JSON.stringify(git.commithash()),
				"DEVELOPMENT": JSON.stringify(false)
			})
		],
		output: {
			hashFunction: "sha256",
			filename: "bundle.js",
			path: output
		}
	}),
	common[1]
];