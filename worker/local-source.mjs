import { promises as fs } from "node:fs";
import path from "node:path";

function childPath(root, candidate) {
  const relative = path.relative(root, candidate);
  return Boolean(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Resolve an EditForge private source URI only inside the read-only source mount. */
export async function localSourcePath(value, env = process.env) {
  const parsed = new URL(value);
  if (parsed.protocol !== "editforge-source:") return null;
  const configured = env.EDITFORGE_SOURCE_MEDIA_DIR?.trim();
  if (!configured) throw new Error("EDITFORGE_SOURCE_MEDIA_DIR is required for private source media");
  if (parsed.hostname || parsed.search || parsed.hash) throw new Error("private source URI is invalid");
  const root = path.resolve(configured);
  const relative = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
  const candidate = path.resolve(root, relative);
  if (!relative || !childPath(root, candidate)) throw new Error("private source URI escapes the source directory");
  const [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(candidate)]);
  if (!childPath(realRoot, realFile)) throw new Error("private source URI escapes the source directory");
  const stat = await fs.stat(realFile);
  if (!stat.isFile()) throw new Error("private source URI must identify a regular file");
  return realFile;
}
