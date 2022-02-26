const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CompressionWebpackPlugin = require('compression-webpack-plugin');
const HtmlWebpackChangeAssetsExtensionPlugin = require('html-webpack-change-assets-extension-plugin')

const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const zlib = require("zlib");


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
                title: 'Development',
                template: 'src/index.html',
                jsExtension: '.br'
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
                    exclude: /\.worker\.js/,
                    // threshold: 10240,
                    threshold: 0,
                    // minRatio: 0.8,
                    minRatio: Infinity,
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
                    test: /\.css$/i,
                    use: [MiniCssExtractPlugin.loader, "css-loader"],
                },
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
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