const Path = require("path");
const Webpack = require("webpack");
const { GitRevisionPlugin } = require("git-revision-webpack-plugin");
const { merge } = require("webpack-merge");
const common = require("./webpack.config.js");

const git = new GitRevisionPlugin();

module.exports = [
	merge(common[0], {
		mode: "development",
		optimization: {
			minimize: false
		},
		devtool: 'inline-source-map',
		performance: {
			hints: false,
		},
		devServer: {
			static: common[0].output.path,
			compress: false,
			historyApiFallback: true,
			hot: true,
			https: false
		},
		plugins: [
			new Webpack.DefinePlugin({
				"VERSION": JSON.stringify(require("./package.json").version),
				"TIMESTAMP": JSON.stringify(new Date().toISOString()),
				"REPOSITORY_BRANCH": JSON.stringify(git.branch()),
				"REPOSITORY_COMMIT": JSON.stringify(git.commithash()),
				"DEVELOPMENT": JSON.stringify(true)
			}),
			new Webpack.HotModuleReplacementPlugin()
		]
	}),
	common[1]
];