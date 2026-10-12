import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const userAgent = process.env.npm_config_user_agent ?? "";
const workspacePackageManager = process.env.WORKSPACE_PACKAGE_MANAGER ?? "";

if (!userAgent.startsWith("pnpm/") && workspacePackageManager !== "pnpm") {
  console.error("Use pnpm instead");
  process.exit(1);
}

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  rmSync(path.join(root, lockfile), { force: true });
}
