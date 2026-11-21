import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const root = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: root });

const config = [
  { ignores: [".next/**", "node_modules/**", "drizzle/**", "dist/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  {
    // The data layer is async: these catch a forgotten `await`, which would
    // otherwise compile (e.g. `if (getUser(id))` is always truthy).
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "tests/**/*.ts"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "@typescript-eslint/await-thenable": "error",
    },
  },
];

export default config;
