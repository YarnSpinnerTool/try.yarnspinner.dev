const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CompressionWebpackPlugin = require('compression-webpack-plugin');
const HtmlWebpackChangeAssetsExtensionPlugin = require('html-webpack-change-assets-extension-plugin')

const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const zlib = require("zlib");

const execSync = require("child_process").execSync;

const gitCommand = "git rev-parse HEAD";

const getGitHash = () => execSync(gitCommand).toString().trim();


module.exports = (env, argv) => {
    const isProduction = argv.mode === "production";

    return {
        entry: {
            index: './src/index.ts',
            playground: './src/playground.ts',
        },
        output: {
            filename: '[name].bundle.js',
            path: path.resolve(__dirname, 'dist'),
            clean: true,
        },
        resolve: {
            extensions: ['.ts', '.js', '.json', '.css', '.ttf']
        },
        plugins: [

            new HtmlWebpackPlugin({
                title: 'Yarn Spinner for JS',
                template: 'src/index.html',
                jsExtension: '.br',
                gitHash: getGitHash().substring(0, 8),
            }),

            new MiniCssExtractPlugin({
                filename: '[name].css'
            }),

            new MonacoWebpackPlugin({
                languages: ["markdown"],
                // filename: isProduction ? "[name].worker.js" : undefined,
            }),

            ...(isProduction ? [ 
                new CompressionWebpackPlugin({
                    filename: "[path][base].br",
                    algorithm: "brotliCompress",
                    test: /\.(js|svg)$/,
                    compressionOptions: {
                        params: {
                            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                        },
                    },
                    // Don't compress *.worker.js, because Monaco doesn't know
                    // to look for .worker.js.br and isn't expecting it to be
                    // compressed
                    exclude: /\.worker\.js/,
                    threshold: 0,
                    minRatio: Infinity,

                    // If DELETE_ORIGINAL_ASSETS is 1, keep only the output and
                    // delete the input files
                    deleteOriginalAssets: (process.env['DELETE_ORIGINAL_ASSETS'] || 0) ? true : false,
                }),
                new HtmlWebpackChangeAssetsExtensionPlugin(),
            ] : []
            )
        ],
        devServer: {
            static: './dist',
            watchFiles: ['src/**/*.html', 'bin/**'],
        },
        devtool: 'source-map',
        mode: 'development',

        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.(sa|sc|c)ss$/,
                    use: [
                      MiniCssExtractPlugin.loader,
                      "css-loader",
                    //   "postcss-loader",
                      "sass-loader",
                    ],
                  },
            ]
        },
        optimization: {
            splitChunks: {
                chunks: 'all',
            },
        }
    };
};