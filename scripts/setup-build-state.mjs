import { createHash } from "node:crypto";
import { readFile, readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function getSetupBuildState(root, nodeVersion = process.versions.node) {
  const hash = createHash("sha256").update(`node:${nodeVersion}\n`);
  const files = ["package.json", "package-lock.json", "tsconfig.json"];
  const collect = async (directory) => {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await collect(name);
      else if (entry.isFile()) files.push(name);
    }
  };
  await collect("src");
  await collect("scripts");
  for (const file of files.sort()) hash.update(file).update("\0").update(await readFile(join(root, file))).update("\0");
  const fingerprint = hash.digest("hex");
  let reusable = false;
  try {
    const previous = JSON.parse(await readFile(join(root, ".zura-build-state.json"), "utf8"));
    await access(join(root, "dist/index.js"));
    await access(join(root, "dist/resources/adobe-uxp-coverage.json"));
    reusable = previous.fingerprint === fingerprint;
  } catch { /* No successful matching build yet. */ }
  return { fingerprint, reusable, nodeVersion };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  getSetupBuildState(resolve(process.argv[2] ?? ".")).then((state) => process.stdout.write(JSON.stringify(state))).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
