import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  /**
   * Generated output is not ours to format.
   *
   * `src/integrations/supabase/types.ts` is written by the Supabase CLI and
   * carried 896 of the tree's 1,088 lint errors — all of them Prettier
   * complaining about a file no human edits. That one number is why lint ran
   * with continue-on-error in CI and therefore gated nothing. Ignoring it
   * lets lint block like typecheck and test do.
   */
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      "src/integrations/supabase/types.ts",
      // Reference copy of the AI Studio prototype, not part of the app.
      "docs/prototype",
      // The preview checker's stand-ins and output; run by hand, not shipped.
      "scripts/preview",
      "scripts/places-bench/out",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    /**
     * Motion is a design token, not a number typed at the call site.
     *
     * Durations and curves live in `src/styles.css` as `--t-*` and `--ease-*`.
     * A component says what the motion means — `duration-(--t-move)` — and the
     * timing stays consistent because there is one place to change it. An
     * arbitrary value here is how the app ended up with seventeen different
     * ideas of how fast a thing should move.
     *
     * `src/components/ui` is vendored shadcn and is exempt: those files are
     * upstream code we re-sync, not ours to restyle.
     */
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/duration-\\[/]",
          message:
            "Use a motion token: duration-(--t-tap|--t-shift|--t-move|--t-arrive), defined in src/styles.css.",
        },
        {
          selector: "TemplateElement[value.raw=/duration-\\[/]",
          message:
            "Use a motion token: duration-(--t-tap|--t-shift|--t-move|--t-arrive), defined in src/styles.css.",
        },
        {
          selector: "Literal[value=/cubic-bezier\\(/]",
          message:
            "Use an easing token: ease-(--ease-standard|--ease-exit|--ease-confirm), defined in src/styles.css.",
        },
        {
          selector: "TemplateElement[value.raw=/cubic-bezier\\(/]",
          message:
            "Use an easing token: ease-(--ease-standard|--ease-exit|--ease-confirm), defined in src/styles.css.",
        },
      ],
    },
  },
  eslintPluginPrettier,
);
