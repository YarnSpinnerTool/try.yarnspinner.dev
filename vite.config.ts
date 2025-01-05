/// <reference types="vitest"/>

import path from 'path';

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { analyzer } from 'vite-bundle-analyzer';
import viteCompression from 'vite-plugin-compression';

const prefix = `monaco-editor/esm/vs`;

export default defineConfig({
    plugins: [
        react(),
        viteCompression({
            algorithm: "brotliCompress",
            deleteOriginFile: false,
        }),
        analyzer({
            openAnalyzer: false,
            analyzerMode: "static"
        }),
    ],
    resolve: {
        alias: {
            '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
        }
    },
    test: {
        environment: "happy-dom",
        setupFiles: ["test/setup.ts"],
        coverage: { include: ["src/**"] },
        browser: {
            provider: 'playwright', // or 'webdriverio'
            enabled: true,
            name: 'chromium', // browser name is required
            headless: true,
        },
    },
    server: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp"
        }
    },
    build: {
        target: "chrome89",
        // Ignore node-specific calls in .NET's JavaScript:
        // https://github.com/dotnet/runtime/issues/91558.
        rollupOptions: {
            external: ["process", "module"],

            output: {
                manualChunks: {
                    // jsonWorker: [`${prefix}/language/json/json.worker`],
                    // cssWorker: [`${prefix}/language/css/css.worker`],
                    // htmlWorker: [`${prefix}/language/html/html.worker`],
                    // tsWorker: [`${prefix}/language/typescript/ts.worker`],
                    editorWorker: [`${prefix}/editor/editor.worker`],
                    monaco: [`monaco-editor`],
                },
            },
        },
    },

    css: {
        preprocessorOptions: {
            scss: {
                // see: https://vite.dev/config/shared-options.html#css-preprocessoroptions
                api: 'modern',
            }
        }
    },

});
