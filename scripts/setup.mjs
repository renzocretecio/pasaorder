import { copyFile, access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
for (const directory of ["apps/api", "apps/web", "packages/db"]) {
  const target = new URL(`${directory}/.env`, root);
  try {
    await access(target);
    console.log(`Keeping ${directory}/.env`);
  } catch {
    await copyFile(
      new URL(`${directory}/.env.example`, root),
      target,
      constants.COPYFILE_EXCL,
    );
    if (directory === "apps/api") {
      const template = await readFile(target, "utf8");
      await writeFile(
        target,
        template.replace(
          "replace-with-a-random-secret-at-least-32-characters",
          randomBytes(48).toString("hex"),
        ),
        { mode: 0o600 },
      );
    }
    console.log(`Created ${directory}/.env`);
  }
  if (directory === "apps/api") {
    const current = await readFile(target, "utf8");
    if (!/^\s*JWT_SECRET\s*=/m.test(current)) {
      await writeFile(
        target,
        `${current.trimEnd()}\nJWT_SECRET=${randomBytes(48).toString("hex")}\n`,
        { mode: 0o600 },
      );
      console.log("Added missing API JWT_SECRET; existing values preserved.");
    }
  }
}
console.log(
  `Environment setup complete in ${fileURLToPath(root)}. Existing files were preserved.`,
);
