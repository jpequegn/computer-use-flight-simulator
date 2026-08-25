import { rmSync } from "node:fs";

for (const directory of ["dist", "web-dist"]) {
  rmSync(directory, { recursive: true, force: true });
}
