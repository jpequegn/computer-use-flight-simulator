import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveWebRoot(): string {
  const installedRoot = fileURLToPath(new URL("../../../web-dist", import.meta.url));
  return existsSync(installedRoot) ? installedRoot : path.resolve("web-dist");
}
