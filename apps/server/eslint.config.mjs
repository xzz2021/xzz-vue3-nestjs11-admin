// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["dist"],
  },

  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      eslintPluginPrettierRecommended,
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
    },
  },

  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.disableTypeChecked,
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
);