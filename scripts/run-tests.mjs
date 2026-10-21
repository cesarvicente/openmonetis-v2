import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(path);
    return /\.test\.tsx?$/.test(entry.name) && !/\.integration\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

const tests = ["apps", "packages"]
  .flatMap((workspace) =>
    readdirSync(join(root, workspace), { withFileTypes: true }).flatMap((entry) => {
      const source = join(root, workspace, entry.name, "src");
      return entry.isDirectory() && existsSync(source) ? findTests(source) : [];
    }),
  )
  .sort();

if (tests.length === 0) throw new Error("No unit or contract test files found");

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...process.argv.slice(2), ...tests],
  {
    cwd: root,
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
