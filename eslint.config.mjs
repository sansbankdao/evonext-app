import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// Next.js 16 removed `next lint`; ESLint is now driven directly via the CLI.
// This flat config replaces the former `.eslintrc.json` that extended
// `next/core-web-vitals`.
const eslintConfig = defineConfig([
    ...nextVitals,
    {
        ignores: [
            "node_modules/**",
            ".next/**",
            "out/**",
            "test-results/**",
            "playwright-report/**",
            // Generated wasm-bindgen output — not human-maintained code.
            "lib/dash-wasm/**",
        ],
    },
    // The react-hooks v6 plugin (shipped with the Next 16 toolchain) enables
    // React Compiler strictness rules that flag ~22 pre-existing patterns
    // across the app (setState-in-effect startup loads, manual memoization
    // shapes, render-time impure calls). Fixing them changes product logic,
    // so they are turned off to preserve the pre-upgrade lint contract
    // (0 errors / 0 warnings) pending a dedicated cleanup pass.
    {
        rules: {
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/preserve-manual-memoization": "off",
            "react-hooks/purity": "off",
            "react-hooks/immutability": "off",
        },
    },
]);

export default eslintConfig;
