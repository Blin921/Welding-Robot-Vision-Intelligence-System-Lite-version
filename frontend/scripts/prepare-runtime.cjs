const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const runtime = path.join(root, ".next", "standalone");
fs.cpSync(
  path.join(root, ".next", "static"),
  path.join(runtime, ".next", "static"),
  { recursive: true },
);
if (fs.existsSync(path.join(root, "public")))
  fs.cpSync(path.join(root, "public"), path.join(runtime, "public"), {
    recursive: true,
  });
console.log(
  "Standalone runtime prepared with static files and reference assets.",
);
