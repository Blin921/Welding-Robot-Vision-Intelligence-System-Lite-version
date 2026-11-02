const path = require("node:path");
const args = process.argv.slice(2);
const port = args.includes("-p")
  ? args[args.indexOf("-p") + 1]
  : process.env.PORT || "3000";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw Error("Invalid port");
process.env.PORT = port;
process.env.HOSTNAME = process.env.WELD_HOST || "0.0.0.0";
require(path.join(__dirname, "..", ".next", "standalone", "server.js"));
