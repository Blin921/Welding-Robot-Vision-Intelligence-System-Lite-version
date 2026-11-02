const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  cwd: root,
  env: { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_DATA_MODE: "demo" },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
