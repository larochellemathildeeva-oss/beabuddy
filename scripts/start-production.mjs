import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const port = process.env.PORT || "4173";
const env = {
  ...process.env,
  PORT: port,
  HOST: process.env.HOST || "0.0.0.0",
  NITRO_HOST: process.env.NITRO_HOST || process.env.HOST || "0.0.0.0",
};

const nodeServer = ".output/server/index.mjs";
const child = existsSync(nodeServer)
  ? spawn(process.execPath, [nodeServer], { stdio: "inherit", env })
  : spawn(
      "npx",
      ["vite", "preview", "--host", "0.0.0.0", "--port", port, "--strictPort"],
      { stdio: "inherit", env },
    );

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
