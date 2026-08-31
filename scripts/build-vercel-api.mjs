import * as esbuild from "esbuild";
import { existsSync } from "node:fs";

const entry = "api/handler.ts";
const outfile = "api/index.cjs";

if (!existsSync(entry)) {
  console.error(`Missing ${entry}`);
  process.exit(1);
}

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile,
  sourcemap: true,
  // Prisma engines must load from node_modules at runtime (not bundled)
  external: ["@prisma/client", ".prisma/client", "prisma"],
  define: {
    "import.meta.url": "_importMetaUrl",
  },
  banner: {
    js: 'const _importMetaUrl=require("url").pathToFileURL(__filename).href;',
  },
  logLevel: "info",
});

console.log(`Vercel API bundle written: ${outfile}`);
