import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
    ...obsidianmd.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsparser,
            parserOptions: { project: "./tsconfig.json" },
            globals: {
                ...globals.browser,
                createElement: "readonly",
                createDiv: "readonly",
                createSpan: "readonly",
            },
        },
        rules: {
            // These are browser globals in Obsidian's environment
            "no-undef": "off",
            // [DEV] prefix strings are exempt from sentence-case — they are development
            // markers intentionally written in a non-standard form. All other UI strings
            // must still follow sentence case.
            "obsidianmd/ui/sentence-case": ["error", {
                ignoreRegex: ["^\\[DEV\\]"],
            }],
        },
    },
]);
