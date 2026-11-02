const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error("Please install Node.js 24 LTS or newer: https://nodejs.org/");
  process.exit(1);
}
const manifestBytes = fs.readFileSync(path.join(root, "package.json"));
const lockBytes = fs.readFileSync(path.join(root, "package-lock.json"));
const manifest = JSON.parse(manifestBytes);
const platform = `${process.platform}/${process.arch}/${process.versions.modules}`;
// Script/README changes do not reinstall dependencies; accept and migrate the previous marker.
const legacyDigest = crypto
  .createHash("sha256")
  .update(manifestBytes)
  .update(lockBytes)
  .update(platform)
  .digest("hex");
const digest = crypto
  .createHash("sha256")
  .update(
    JSON.stringify({
      dependencies: manifest.dependencies,
      devDependencies: manifest.devDependencies,
      optionalDependencies: manifest.optionalDependencies,
      overrides: manifest.overrides,
    }),
  )
  .update(lockBytes)
  .update(platform)
  .digest("hex");
const marker = path.join(root, "node_modules", ".weld-dependencies.sha256");
const present = ["next", "react", "react-dom", "three", "typescript"].every(
  (name) =>
    fs.existsSync(path.join(root, "node_modules", name, "package.json")),
);
if (
  present &&
  fs.existsSync(marker) &&
  [digest, legacyDigest].includes(fs.readFileSync(marker, "utf8"))
) {
  fs.writeFileSync(marker, digest);
  console.log("Dependencies unchanged; skipping npm ci.");
  process.exit(0);
}
console.log(
  "First launch or changed dependencies: installing locked packages...",
);
const windows = process.platform === "win32";
const result = spawnSync(
  windows ? process.env.ComSpec || "cmd.exe" : "npm",
  windows
    ? ["/d", "/s", "/c", "npm ci --include=dev --no-audit --no-fund"]
    : ["ci", "--include=dev", "--no-audit", "--no-fund"],
  { cwd: root, stdio: "inherit" },
);
if (result.error || result.status !== 0) {
  console.error(
    result.error?.message ||
      "npm ci failed. Check the network or npm registry.",
  );
  process.exit(result.status || 1);
}
fs.writeFileSync(marker, digest);
