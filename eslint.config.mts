import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig({
  ignores: ["dist/**", "node_modules/**", ".next/**", "build/**"],
  overrides: [
    { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
    tseslint.configs.recommended,
    pluginReact.configs.flat.recommended,
    // Project-specific rule overrides: treat common warnings as errors
    {
      rules: {
        // Disable base rule and use TypeScript-specific rule for unused vars.
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        // Disallow anonymous default exports
        'import/no-anonymous-default-export': 'error',
        // Enforce no assigning to `module` variable (Next.js rule)
        '@next/next/no-assign-module-variable': 'error',
      },
    },
  ],
});
