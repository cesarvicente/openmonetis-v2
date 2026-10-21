import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const commands = Object.keys(scripts)
  .filter((name) => /^test:.+:integration$/.test(name))
  .sort();
if (!commands.length) throw new Error("No integration suites found");
let failed = false;
for (const command of commands) {
  const result = spawnSync("pnpm", [command], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
