import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * ESLint was never actually installed here.
 *
 * `package.json` carried a `lint` script pointing at `next lint`, which in
 * Next 15 is deprecated and — with no ESLint config present — drops into an
 * interactive "how would you like to configure ESLint?" prompt. Run in CI it
 * would have hung or failed; nothing ever ran it, so nobody found out. A lint
 * script that cannot lint is the same class of dead promise as a button that
 * posts nothing.
 *
 * This is the real thing: flat config, the Next rules, run by `eslint .`, and
 * blocking in CI.
 */
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "public/**",
      "coverage/**",
    ],
  },
  {
    rules: {
      // An unused variable is usually a half-finished edit — a value read from
      // a store and never rendered, an import left behind. Those are worth
      // failing on. A deliberately-ignored binding is spelled with a leading
      // underscore so the intent is visible in the code rather than in a
      // suppression comment.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default config;
