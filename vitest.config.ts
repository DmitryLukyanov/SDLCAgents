import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { existsSync } from "fs";
import type { Plugin } from "vite";

/**
 * Vite plugin that resolves `.js` import specifiers to `.ts` source files.
 * Required for NodeNext ESM projects where TypeScript source uses `.js`
 * extensions in import paths but the actual files on disk are `.ts`.
 */
function nodeNextTsResolver(): Plugin {
  return {
    name: "nodenext-ts-resolver",
    enforce: "pre",
    resolveId(id, importer) {
      if (!importer || !id.endsWith(".js")) return undefined;

      // Derive the absolute path from the importer's directory
      const importerDir = resolve(importer, "..");
      const jsPath = resolve(importerDir, id);
      const tsPath = jsPath.slice(0, -3) + ".ts";

      if (existsSync(tsPath)) {
        return tsPath;
      }
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [nodeNextTsResolver()],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
