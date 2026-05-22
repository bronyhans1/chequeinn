/**
 * Removes the Next.js `.next` output directory before a production build.
 * Stale caches after route/file renames can cause PageNotFoundError / ENOENT during `next build`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nextDir = path.join(__dirname, "..", ".next");

if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("[clean-next] Removed .next");
}
