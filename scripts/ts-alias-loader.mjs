import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const srcRoot = resolvePath(import.meta.dirname, "../src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = resolvePath(srcRoot, specifier.slice(2));
    const candidates = [abs, `${abs}.ts`, `${abs}.tsx`, `${abs}.js`, `${abs}.mjs`];
    const hit = candidates.find((p) => existsSync(p));
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
    return nextResolve(pathToFileURL(abs).href, context);
  }
  if (specifier.startsWith(".") && context.parentURL) {
    const parent = new URL(context.parentURL);
    if (parent.pathname.includes("/src/")) {
      const abs = resolvePath(parent.pathname.replace(/\/[^/]+$/, ""), specifier);
      const candidates = [abs, `${abs}.ts`, `${abs}.tsx`];
      const hit = candidates.find((p) => existsSync(p));
      if (hit && !existsSync(abs)) return nextResolve(pathToFileURL(hit).href, context);
    }
  }
  return nextResolve(specifier, context);
}
