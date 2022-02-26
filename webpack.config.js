const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CompressionWebpackPlugin = require('compression-webpack-plugin');

const zlib = require("zlib");

module.exports = {
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
            template: 'src/index.html'
        }),
        new MonacoWebpackPlugin({
            languages: ["markdown"],
        }),
        new CompressionWebpackPlugin({
            filename: "[path][base].br",
            algorithm: "brotliCompress",
            test: /\.(js|css|html|svg)$/,
            compressionOptions: {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
              },
            },
            threshold: 10240,
            minRatio: 0.8,
            deleteOriginalAssets: (process.env['DELETE_ORIGINAL_ASSETS'] || 0) ? true : false,
          }),
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
                use: ['style-loader', 'css-loader'],
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