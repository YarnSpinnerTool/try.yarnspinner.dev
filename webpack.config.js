const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CompressionWebpackPlugin = require('compression-webpack-plugin');

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
        new CompressionWebpackPlugin(),
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