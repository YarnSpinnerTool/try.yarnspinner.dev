import * as monaco from "monaco-editor";

import * as yarnspinner_language from "./yarnspinner-language";

import * as theme from "virtual:tailwind-config"

function resolveColorFromTheme(colorMap: typeof theme.colors, colorName: string): string {
    const colorNotFound = "#ff00ff";
    const color = colorMap[colorName];

    if (!color) {
        console.warn(`Failed to resolve color ${colorName}: Color not found in theme`);
        return colorNotFound;
    }

    if (typeof color === "string") {
        return color;
    }

    const resolvedColor = color["DEFAULT"];

    if (!resolvedColor) {
        console.warn(`Failed to resolve color ${colorName}: No default found for color`);
        return colorNotFound;
    }
    return resolvedColor;
}

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
// import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
// import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
// import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
// import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
    getWorker() {
        // if (label === "json") {
        //     return new jsonWorker();
        // }
        // if (label === "css" || label === "scss" || label === "less") {
        //     return new cssWorker();
        // }
        // if (label === "html" || label === "handlebars" || label === "razor") {
        //     return new htmlWorker();
        // }
        // if (label === "typescript" || label === "javascript") {
        //     return new tsWorker();
        // }
        return new editorWorker();
    },
};

function setupGlobalMonaco() {
    monaco.languages.register({
        id: "yarnspinner",
        extensions: [".yarn", ".yarnproject"],
    });

    monaco.languages.setLanguageConfiguration(
        "yarnspinner",
        yarnspinner_language.configuration
    );

    monaco.languages.setMonarchTokensProvider(
        "yarnspinner",
        yarnspinner_language.monarchLanguage
    );


    const colors = {
        black: resolveColorFromTheme(theme.colors, "black"),
        olive: resolveColorFromTheme(theme.colors, "olive"),
        green: resolveColorFromTheme(theme.colors, "green"),
        yellow: resolveColorFromTheme(theme.colors, "yellow"),
        red: resolveColorFromTheme(theme.colors, "red"),
        blue: resolveColorFromTheme(theme.colors, "blue"),
        // grey: "#818582",
        // grey: "#abb0ac",
        // dark_green: "#4c8962",
        // lightgreen: "#a8bd9b",
        // pink: "#f2a9a0",
    };

    monaco.editor.defineTheme("yarnspinner", {
        base: "vs",
        inherit: true,
        rules: [
            { token: "line.character", fontStyle: "bold" },
            { token: "comment", foreground: colors.green, fontStyle: "italic" },

            // { token: 'comment', foreground: 'aaaaaa', fontStyle: 'italic' },
            { token: "keyword", foreground: colors.blue },
            { token: "operator", foreground: colors.black },
            { token: "namespace", foreground: colors.blue },

            { token: "type", foreground: colors.red },
            { token: "enum", foreground: colors.red },
            { token: "function", foreground: colors.olive },

            { token: "number", foreground: colors.green },

            { token: "identifier", foreground: colors.blue },

            { token: "string", foreground: colors.red },

            { token: "variable", foreground: colors.yellow },
        ],
        colors: {
            "editor.foreground": "#000000",
        },
    });
}

setupGlobalMonaco();

// monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);