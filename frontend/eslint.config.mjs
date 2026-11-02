import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".static-export/**",
    "node_modules/**",
    "screenshots/**",
    "next-env.d.ts",
  ]),
  {
    files: ["scripts/**/*.cjs", "distribution/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
