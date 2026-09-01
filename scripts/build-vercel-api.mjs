import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const entry = path.join(root, "server/vercel-handler.ts");
// Catch-all: handles /api, /api/auth/login, etc. (api/index.js only handles /api → 405 on POST subpaths)
const outfile = path.join(root, "api/[...path].js");
const prismaClientDir = path.join(root, "node_modules/.prisma/client");

if (!fs.existsSync(path.join(prismaClientDir, "index.js"))) {
  console.error(
    "Prisma client not generated. Run: prisma generate --schema=./backend/prisma/schema.prisma"
  );
  process.exit(1);
}

for (const stale of [
  "api/index.js",
  "api/index.js.map",
  "api/index.cjs",
  "api/index.cjs.map",
]) {
  const file = path.join(root, stale);
  if (fs.existsSync(file)) fs.unlinkSync(file);
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
  packages: "bundle",
  plugins: [prismaResolvePlugin],
  external: [],
  define: {
    "import.meta.url": "_importMetaUrl",
  },
  banner: {
    js: 'const _importMetaUrl=require("url").pathToFileURL(__filename).href;',
  },
  footer: {
    js: `
const __handler = module.exports.default ?? module.exports;
module.exports = __handler;
module.exports.default = __handler;
`,
  },
  logLevel: "info",
});

console.log(`Vercel API bundle written to ${outfile}`);
