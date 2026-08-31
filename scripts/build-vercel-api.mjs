import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const entry = path.join(root, "server/vercel-handler.ts");
const outfile = path.join(root, "api/index.cjs");
const prismaClientDir = path.join(root, "node_modules/.prisma/client");

if (!fs.existsSync(path.join(prismaClientDir, "index.js"))) {
  console.error(
    "Prisma client not generated. Run: prisma generate --schema=./backend/prisma/schema.prisma"
  );
  process.exit(1);
}

/** Resolve @prisma/client and .prisma/client to the generated client entry. */
const prismaResolvePlugin = {
  name: "prisma-resolve",
  setup(build) {
    build.onResolve({ filter: /^@prisma\/client/ }, () => ({
      path: path.join(prismaClientDir, "index.js"),
    }));
    build.onResolve({ filter: /^\.prisma\/client/ }, (args) => {
      const subpath = args.path.replace(/^\.prisma\/client\/?/, "") || "index.js";
      return { path: path.join(prismaClientDir, subpath) };
    });
  },
};

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile,
  sourcemap: true,
  // Bundle every dependency — no runtime require() of node_modules
  packages: "bundle",
  plugins: [prismaResolvePlugin],
  // Node built-ins only
  external: [],
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
