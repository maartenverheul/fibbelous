import path from "path";
import { fileURLToPath } from "url";
import typescript from "@rollup/plugin-typescript";
import alias from "@rollup/plugin-alias";

const projectRootDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("rollup").RollupOptions} */
export default {
  input: "src/index.ts",
  output: {
    file: "dist/index.mjs",
    format: "cjs",
    format: "es",
    compact: true,
  },
  external: [
    "@trpc/server",
    "@trpc/server/observable",
    "@trpc/server/adapters/ws",
    "cors",
    "express",
    "events",
    "ws",
    "zod",
  ],
  plugins: [
    alias({
      entries: [
        { find: "@", replacement: path.resolve(projectRootDir, "src") },
      ],
    }),
    typescript(),
  ],
};
