import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const entry = path.join(root, "server/vercel-handler.ts");
const outfile = path.join(root, "api/index.cjs");

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile,
  sourcemap: true,
  // Prisma generated client + pg adapter (no Rust engine binary)
  external: [
    "@prisma/client",
    ".prisma/client",
    "prisma",
    "@prisma/adapter-pg",
    "pg",
  ],
  define: {
    "import.meta.url": "_importMetaUrl",
  },
  banner: {
    js: 'const _importMetaUrl=require("url").pathToFileURL(__filename).href;',
  },
  footer: {
    js: "module.exports = module.exports.default ?? module.exports;",
  },
  logLevel: "info",
});

console.log(`Vercel API bundle written to ${outfile}`);
