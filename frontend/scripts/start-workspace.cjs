const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "0.0.0.0", port, exclusive: true }, () => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });
}
async function main() {
  const value = process.env.WELD_PORT || "3000";
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error("WELD_PORT must be a port between 1 and 65535.");
  }
  const port = Number(value);
  try {
    await checkPort(port);
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
    console.error(`Port ${port} is already occupied. The app has NOT started.`);
    console.error("An older server may still be showing the previous page.");
    console.error("Close the old server's CMD window, or press Ctrl+C in it, then retry.");
    console.error(`To identify the listener on Windows: netstat -ano | findstr :${port}`);
    console.error("No process was stopped automatically; no alternate port was selected.");
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--check")) return;
  const revision = spawnSync("git", ["log", "-1", "--oneline"], {
    cwd: root, encoding: "utf8", windowsHide: true,
  });
  console.log(`Project: ${path.dirname(root)}`);
  console.log(`Version: ${revision.status === 0 ? revision.stdout.trim() : "local copy (Git revision unavailable)"}`);
  console.log(`Open exactly: http://localhost:${port}`);
  const child = spawn(process.execPath, [
    require.resolve("next/dist/bin/next"), "dev", "-H", "0.0.0.0", "-p", String(port),
  ], { cwd: root, stdio: "inherit" });
  child.once("error", (error) => { console.error(error.message); process.exitCode = 1; });
  child.once("exit", (code) => { process.exitCode = code ?? 1; });
}
if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { checkPort };
