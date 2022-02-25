const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
    entry: './src/index.ts',
    output: {
        filename: 'main.js',
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
        new MonacoWebpackPlugin(),
    ],
    devServer: {
        static: './dist',
        watchFiles: ['src/**/*.html', 'bin/**'],
    },
    devtool: 'inline-source-map',
    mode: 'production',

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
    }


};